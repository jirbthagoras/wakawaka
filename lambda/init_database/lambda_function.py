import json
import os
import psycopg2
from datetime import datetime
import uuid

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
    Initialize database schema and optionally insert sample data
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create customers table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                customer_id VARCHAR(50) PRIMARY KEY,
                customer_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create orders table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                order_id VARCHAR(50) PRIMARY KEY,
                customer_id VARCHAR(50) NOT NULL,
                order_date TIMESTAMP NOT NULL,
                status VARCHAR(20) NOT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
            )
        """)
        
        # Create inventory table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                product_id VARCHAR(50) PRIMARY KEY,
                product_name VARCHAR(100) NOT NULL,
                stock_quantity INTEGER NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create order_items table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                order_item_id SERIAL PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                product_id VARCHAR(50) NOT NULL,
                quantity INTEGER NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                FOREIGN KEY (product_id) REFERENCES inventory(product_id)
            )
        """)
        
        # Create indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)")
        
        conn.commit()
        
        # Insert sample data if requested
        insert_sample = event.get('insert_sample_data', True)
        
        if insert_sample:
            # Check if data already exists
            cur.execute("SELECT COUNT(*) FROM customers")
            if cur.fetchone()[0] == 0:
                insert_sample_data(cur, conn)
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Database initialized successfully',
                'sample_data_inserted': insert_sample
            })
        }
        
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Database initialization failed',
                'error': str(e)
            })
        }

def insert_sample_data(cur, conn):
    """Insert sample data for testing"""
    
    # Sample customers
    customers = [
        (str(uuid.uuid4()), 'John Doe', 'john@example.com', '+1234567890', '123 Main St'),
        (str(uuid.uuid4()), 'Jane Smith', 'jane@example.com', '+1234567891', '456 Oak Ave'),
        (str(uuid.uuid4()), 'Bob Johnson', 'bob@example.com', '+1234567892', '789 Pine Rd'),
        (str(uuid.uuid4()), 'Alice Williams', 'alice@example.com', '+1234567893', '321 Elm St'),
        (str(uuid.uuid4()), 'Charlie Brown', 'charlie@example.com', '+1234567894', '654 Maple Dr')
    ]
    
    for customer in customers:
        cur.execute("""
            INSERT INTO customers (customer_id, customer_name, email, phone, address)
            VALUES (%s, %s, %s, %s, %s)
        """, customer)
    
    # Sample products
    products = [
        (str(uuid.uuid4()), 'Laptop', 100, 999.99),
        (str(uuid.uuid4()), 'Mouse', 500, 29.99),
        (str(uuid.uuid4()), 'Keyboard', 300, 79.99),
        (str(uuid.uuid4()), 'Monitor', 150, 299.99),
        (str(uuid.uuid4()), 'Headphones', 200, 149.99),
        (str(uuid.uuid4()), 'Webcam', 180, 89.99),
        (str(uuid.uuid4()), 'USB Cable', 1000, 9.99),
        (str(uuid.uuid4()), 'External HDD', 250, 119.99),
        (str(uuid.uuid4()), 'USB Hub', 400, 39.99),
        (str(uuid.uuid4()), 'Laptop Stand', 350, 49.99)
    ]
    
    product_ids = []
    for product in products:
        cur.execute("""
            INSERT INTO inventory (product_id, product_name, stock_quantity, price)
            VALUES (%s, %s, %s, %s)
        """, product)
        product_ids.append(product[0])
    
    # Sample orders
    customer_ids = [c[0] for c in customers]
    
    for i in range(10):
        order_id = str(uuid.uuid4())
        customer_id = customer_ids[i % len(customer_ids)]
        
        cur.execute("""
            INSERT INTO orders (order_id, customer_id, order_date, status, total_amount)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, customer_id, datetime.now(), 'completed', 0))
        
        # Add 1-3 items per order
        import random
        num_items = random.randint(1, 3)
        total = 0
        
        for j in range(num_items):
            product_idx = random.randint(0, len(product_ids) - 1)
            product_id = product_ids[product_idx]
            quantity = random.randint(1, 3)
            price = products[product_idx][3]
            
            cur.execute("""
                INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (order_id, product_id, quantity, price))
            
            total += quantity * price
        
        # Update order total
        cur.execute("""
            UPDATE orders SET total_amount = %s WHERE order_id = %s
        """, (total, order_id))
    
    conn.commit()
    print("Sample data inserted successfully")