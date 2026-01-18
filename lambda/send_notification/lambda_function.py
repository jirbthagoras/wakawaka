import json
import os
import boto3

sns_client = boto3.client('sns')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')

def lambda_handler(event, context):
    """
    Send notifications via SNS
    """
    try:
        order_id = event.get('order_id')
        notification_type = event.get('notification_type', 'order_confirmation')
        
        # Build notification message based on type
        if notification_type == 'order_confirmation':
            subject = f"Order Confirmation - {order_id}"
            message = f"""
Order Confirmation

Order ID: {order_id}
Status: Confirmed
Payment: Success

Your order has been successfully processed and confirmed.
Thank you for your order!

Transaction ID: {event.get('transaction_id', 'N/A')}
Amount: ${event.get('total_amount', 0)}
            """
        elif notification_type == 'payment_failed':
            subject = f"Payment Failed - {order_id}"
            message = f"""
Payment Processing Failed

Order ID: {order_id}
Status: Payment Failed

We were unable to process your payment. 
Please try again or contact support.
            """
        elif notification_type == 'order_shipped':
            subject = f"Order Shipped - {order_id}"
            message = f"""
Order Shipped

Order ID: {order_id}
Status: Shipped

Your order has been shipped and is on the way!
            """
        elif notification_type == 'low_stock':
            subject = "Low Stock Alert"
            message = f"""
Low Stock Alert

The following products have low stock levels:
{json.dumps(event.get('low_stock_items', []), indent=2)}

Please reorder soon.
            """
        elif notification_type == 'system_error':
            subject = f"System Error - {order_id}"
            message = f"""
System Error Notification

Order ID: {order_id}
Error: {event.get('error_message', 'Unknown error')}

Please investigate immediately.
            """
        else:
            subject = "Order Management Notification"
            message = json.dumps(event, indent=2)
        
        # Send SNS notification
        response = sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        
        return {
            'order_id': order_id,
            'status': 'success',
            'message': 'Notification sent successfully',
            'message_id': response['MessageId']
        }
        
    except Exception as e:
        print(f"Error sending notification: {str(e)}")
        return {
            'order_id': event.get('order_id'),
            'status': 'error',
            'message': f'Notification failed: {str(e)}'
        }