import json
import os
import psycopg2

DB_HOST = os.environ.get('DB_HOST')
DB_NAME = os.environ.get('DB_NAME')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def lambda_handler(event, context):
    """
    Update inventory after successful payment
    """
    try:
        order_id = event.get('order_id')
        items = event.get('items', [])
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        updated_items = []
        
        for item in items:
            product_id = item['product_id']
            quantity = item['quantity']
            
            # Check current stock
            cur.execute("""
                SELECT stock_quantity FROM inventory 
                WHERE product_id = %s
            """, (product_id,))
            
            row = cur.fetchone()
            if not row:
                raise Exception(f"Product {product_id} not found in inventory")
            
            current_stock = row[0]
            
            if current_stock < quantity:
                raise Exception(f"Insufficient stock for product {product_id}")
            
            # Update inventory
            new_stock = current_stock - quantity
            cur.execute("""
                UPDATE inventory 
                SET stock_quantity = %s, last_updated = NOW()
                WHERE product_id = %s
            """, (new_stock, product_id))
            
            updated_items.append({
                'product_id': product_id,
                'quantity_deducted': quantity,
                'previous_stock': current_stock,
                'new_stock': new_stock
            })
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'order_id': order_id,
            'status': 'success',
            'message': 'Inventory updated successfully',
            'updated_items': updated_items
        }
        
    except Exception as e:
        print(f"Error updating inventory: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        
        return {
            'order_id': event.get('order_id'),
            'status': 'error',
            'message': f'Inventory update failed: {str(e)}'
        }