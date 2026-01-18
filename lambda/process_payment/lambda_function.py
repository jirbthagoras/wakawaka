import json
import random
import time

def lambda_handler(event, context):
    """
    Simulate payment processing
    """
    try:
        order_id = event.get('order_id')
        total_amount = event.get('total_amount', 0)
        
        # Simulate payment processing delay
        time.sleep(2)
        
        # Simulate payment success/failure (90% success rate)
        payment_success = random.random() < 0.9
        
        if payment_success:
            payment_status = 'success'
            transaction_id = f"TXN-{order_id[:8]}-{int(time.time())}"
            message = 'Payment processed successfully'
        else:
            payment_status = 'failed'
            transaction_id = None
            message = 'Payment processing failed'
        
        return {
            'order_id': order_id,
            'paymentStatus': payment_status,
            'transaction_id': transaction_id,
            'amount': total_amount,
            'message': message,
            'timestamp': int(time.time())
        }
        
    except Exception as e:
        print(f"Error processing payment: {str(e)}")
        return {
            'order_id': event.get('order_id'),
            'paymentStatus': 'error',
            'transaction_id': None,
            'message': f'Payment error: {str(e)}',
            'timestamp': int(time.time())
        }