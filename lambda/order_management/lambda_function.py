import json
import os
import boto3
import psycopg2
from datetime import datetime
import uuid

# Environment variables
DB_HOST = os.environ.get('DB_HOST')
DB_NAME = os.environ.get('DB_NAME')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
S3_BUCKET = os.environ.get('S3_BUCKET')
STEP_FUNCTION_ARN = os.environ.get('STEP_FUNCTION_ARN')

s3_client = boto3.client('s3')
sfn_client = boto3.client('stepfunctions')

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def lambda_handler(event, context):
    try:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        path_params = event.get('pathParameters') or {}
        
        if http_method == 'GET' and path == '/orders':
            return list_orders(event)
        elif http_method == 'POST' and path == '/orders':
            return create_order(event)
        elif http_method == 'GET' and '/orders/' in path:
            return get_order(path_params.get('id'))
        elif http_method == 'PUT' and '/orders/' in path:
            return update_order(path_params.get('id'), event)
        elif http_method == 'DELETE' and '/orders/' in path:
            return delete_order(path_params.get('id'))
        elif http_method == 'GET' and '/status/' in path:
            return check_workflow_status(path_params.get('id'))
        else:
            return response(400, {'message': 'Invalid request'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'message': 'Internal server error', 'error': str(e)})

def list_orders(event):
    query_params = event.get('queryStringParameters') or {}
    page = int(query_params.get('page', 1))
    limit = int(query_params.get('limit', 10))
    offset = (page - 1) * limit
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM orders")
    total = cur.fetchone()[0]
    
    cur.execute("""
        SELECT o.order_id, o.customer_id, o.order_date, o.status, 
               o.total_amount, c.customer_name, c.email
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        ORDER BY o.order_date DESC
        LIMIT %s OFFSET %s
    """, (limit, offset))
    
    orders = []
    for row in cur.fetchall():
        orders.append({
            'order_id': row[0],
            'customer_id': row[1],
            'order_date': row[2].isoformat() if row[2] else None,
            'status': row[3],
            'total_amount': float(row[4]) if row[4] else 0,
            'customer_name': row[5],
            'email': row[6]
        })
    
    cur.close()
    conn.close()
    
    return response(200, {
        'orders': orders,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'total_pages': (total + limit - 1) // limit
        }
    })

def create_order(event):
    body = json.loads(event.get('body', '{}'))
    
    customer_id = body.get('customer_id')
    items = body.get('items', [])
    
    if not customer_id or not items:
        return response(400, {'message': 'customer_id and items are required'})
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Calculate total
    total_amount = sum(item['quantity'] * item['price'] for item in items)
    
    # Create order
    order_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO orders (order_id, customer_id, order_date, status, total_amount)
        VALUES (%s, %s, %s, %s, %s)
    """, (order_id, customer_id, datetime.now(), 'pending', total_amount))
    
    # Create order items
    for item in items:
        cur.execute("""
            INSERT INTO order_items (order_id, product_id, quantity, price)
            VALUES (%s, %s, %s, %s)
        """, (order_id, item['product_id'], item['quantity'], item['price']))
    
    conn.commit()
    
    # Save to S3
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=f"orders/{order_id}.json",
        Body=json.dumps(body),
        ContentType='application/json'
    )
    
    # Start Step Function
    sfn_client.start_execution(
        stateMachineArn=STEP_FUNCTION_ARN,
        name=f"order-{order_id}",
        input=json.dumps({
            'order_id': order_id,
            'customer_id': customer_id,
            'total_amount': total_amount,
            'items': items
        })
    )
    
    cur.close()
    conn.close()
    
    return response(201, {
        'message': 'Order created successfully',
        'order_id': order_id
    })

def get_order(order_id):
    if not order_id:
        return response(400, {'message': 'order_id is required'})
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT o.order_id, o.customer_id, o.order_date, o.status, 
               o.total_amount, c.customer_name, c.email
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.order_id = %s
    """, (order_id,))
    
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return response(404, {'message': 'Order not found'})
    
    # Get order items
    cur.execute("""
        SELECT oi.product_id, oi.quantity, oi.price, i.product_name
        FROM order_items oi
        JOIN inventory i ON oi.product_id = i.product_id
        WHERE oi.order_id = %s
    """, (order_id,))
    
    items = []
    for item_row in cur.fetchall():
        items.append({
            'product_id': item_row[0],
            'quantity': item_row[1],
            'price': float(item_row[2]),
            'product_name': item_row[3]
        })
    
    order = {
        'order_id': row[0],
        'customer_id': row[1],
        'order_date': row[2].isoformat() if row[2] else None,
        'status': row[3],
        'total_amount': float(row[4]) if row[4] else 0,
        'customer_name': row[5],
        'email': row[6],
        'items': items
    }
    
    cur.close()
    conn.close()
    
    return response(200, order)

def update_order(order_id, event):
    if not order_id:
        return response(400, {'message': 'order_id is required'})
    
    body = json.loads(event.get('body', '{}'))
    status = body.get('status')
    
    if not status:
        return response(400, {'message': 'status is required'})
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE orders SET status = %s WHERE order_id = %s
    """, (status, order_id))
    
    if cur.rowcount == 0:
        cur.close()
        conn.close()
        return response(404, {'message': 'Order not found'})
    
    conn.commit()
    cur.close()
    conn.close()
    
    return response(200, {'message': 'Order updated successfully'})

def delete_order(order_id):
    if not order_id:
        return response(400, {'message': 'order_id is required'})
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
    cur.execute("DELETE FROM orders WHERE order_id = %s", (order_id,))
    
    if cur.rowcount == 0:
        cur.close()
        conn.close()
        return response(404, {'message': 'Order not found'})
    
    conn.commit()
    cur.close()
    conn.close()
    
    return response(200, {'message': 'Order deleted successfully'})

def check_workflow_status(order_id):
    if not order_id:
        return response(400, {'message': 'order_id is required'})
    
    try:
        result = sfn_client.describe_execution(
            executionArn=f"{STEP_FUNCTION_ARN.replace(':stateMachine:', ':execution:')}:order-{order_id}"
        )
        
        return response(200, {
            'status': result['status'],
            'startDate': result['startDate'].isoformat(),
            'stopDate': result.get('stopDate', '').isoformat() if result.get('stopDate') else None
        })
    except Exception as e:
        return response(404, {'message': 'Workflow not found', 'error': str(e)})

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key'
        },
        'body': json.dumps(body)
    }