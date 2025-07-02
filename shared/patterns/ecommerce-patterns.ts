import { WorkflowPattern } from './index';

export const ecommercePatterns: WorkflowPattern[] = [
  {
    id: 'order-fulfillment-automation',
    name: 'Complete Order Fulfillment Automation',
    description: 'Automate order processing, inventory updates, shipping, and customer notifications',
    keywords: ['order', 'fulfillment', 'shipping', 'inventory', 'ecommerce', 'process', 'notification'],
    category: 'ecommerce',
    difficulty: 'complex',
    requiredServices: ['ecommerce', 'inventory', 'shipping', 'email', 'sms'],
    examples: [
      'Automate order fulfillment from payment to shipping',
      'Process orders and update inventory automatically',
      'Create automated order workflow with notifications'
    ],
    tags: ['orders', 'fulfillment', 'inventory', 'shipping'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'order_webhook',
            name: 'New Order',
            type: 'n8n-nodes-base.webhook',
            position: [250, 300],
            parameters: {
              path: 'new-order',
              responseMode: 'onReceived'
            }
          },
          {
            id: 'validate_order',
            name: 'Validate Order',
            type: 'n8n-nodes-base.if',
            position: [450, 300],
            parameters: {
              conditions: {
                boolean: [
                  {
                    value1: '={{$json["payment_status"]}}',
                    operation: 'equal',
                    value2: 'paid'
                  }
                ]
              }
            }
          },
          {
            id: 'check_inventory',
            name: 'Check Inventory',
            type: 'n8n-nodes-base.httpRequest',
            position: [650, 300],
            parameters: {
              method: 'POST',
              url: '{{$env.INVENTORY_API}}/check',
              bodyParametersJson: '={"items": {{$json["items"]}}, "warehouse": "{{$json["shipping_address"]["country"]}}"}'
            }
          },
          {
            id: 'update_inventory',
            name: 'Update Inventory',
            type: 'n8n-nodes-base.httpRequest',
            position: [850, 300],
            parameters: {
              method: 'POST',
              url: '{{$env.INVENTORY_API}}/deduct',
              bodyParametersJson: '={"items": {{$json["items"]}}, "order_id": "{{$json["order_id"]}}"}'
            }
          },
          {
            id: 'create_shipping_label',
            name: 'Create Shipping Label',
            type: 'n8n-nodes-base.httpRequest',
            position: [1050, 300],
            parameters: {
              method: 'POST',
              url: 'https://api.shippo.com/shipments',
              authentication: 'genericCredentialType',
              genericAuthType: 'bearerToken',
              bodyParametersJson: `={
                "address_from": {{$env.WAREHOUSE_ADDRESS}},
                "address_to": {{$json["shipping_address"]}},
                "parcels": {{$json["parcels"]}},
                "async": false
              }`
            }
          },
          {
            id: 'send_confirmation',
            name: 'Send Order Confirmation',
            type: 'n8n-nodes-base.emailSend',
            position: [1250, 200],
            parameters: {
              fromEmail: '{{$env.COMPANY_EMAIL}}',
              toEmail: '={{$json["customer_email"]}}',
              subject: 'Order Confirmation - #{{$json["order_id"]}}',
              emailType: 'html',
              message: `
                <h1>Thank you for your order!</h1>
                <p>Hi {{$json["customer_name"]}},</p>
                <p>Your order #{{$json["order_id"]}} has been confirmed and is being processed.</p>
                <h2>Order Details:</h2>
                <ul>
                {{#each $json["items"]}}
                  <li>{{this.name}} - Qty: {{this.quantity}} - \${{this.price}}</li>
                {{/each}}
                </ul>
                <p><strong>Total: \${{$json["total"]}}</strong></p>
                <p>Tracking Number: {{$json["tracking_number"]}}</p>
              `
            }
          },
          {
            id: 'send_sms',
            name: 'Send SMS Notification',
            type: 'n8n-nodes-base.twilio',
            position: [1250, 400],
            parameters: {
              resource: 'sms',
              operation: 'send',
              from: '{{$env.TWILIO_PHONE}}',
              to: '={{$json["customer_phone"]}}',
              message: 'Your order #{{$json["order_id"]}} is confirmed! Track: {{$json["tracking_url"]}}'
            }
          },
          {
            id: 'update_order_status',
            name: 'Update Order Status',
            type: 'n8n-nodes-base.httpRequest',
            position: [1450, 300],
            parameters: {
              method: 'PATCH',
              url: '{{$env.ECOMMERCE_API}}/orders/{{$json["order_id"]}}',
              bodyParametersJson: '={"status": "processing", "tracking_number": "{{$json["tracking_number"]}}", "shipped_at": "{{$now.toISO()}}"}'
            }
          }
        ],
        connections: {
          'New Order': {
            main: [[{ node: 'Validate Order', type: 'main', index: 0 }]]
          },
          'Validate Order': {
            main: [
              [{ node: 'Check Inventory', type: 'main', index: 0 }],
              []
            ]
          },
          'Check Inventory': {
            main: [[{ node: 'Update Inventory', type: 'main', index: 0 }]]
          },
          'Update Inventory': {
            main: [[{ node: 'Create Shipping Label', type: 'main', index: 0 }]]
          },
          'Create Shipping Label': {
            main: [[
              { node: 'Send Order Confirmation', type: 'main', index: 0 },
              { node: 'Send SMS Notification', type: 'main', index: 0 }
            ]]
          },
          'Send Order Confirmation': {
            main: [[{ node: 'Update Order Status', type: 'main', index: 0 }]]
          },
          'Send SMS Notification': {
            main: [[{ node: 'Update Order Status', type: 'main', index: 0 }]]
          }
        }
      }
    }
  },
  {
    id: 'abandoned-cart-recovery',
    name: 'Abandoned Cart Recovery Campaign',
    description: 'Automatically recover abandoned carts with personalized emails and incentives',
    keywords: ['abandoned', 'cart', 'recovery', 'email', 'reminder', 'discount', 'ecommerce'],
    category: 'ecommerce',
    difficulty: 'intermediate',
    requiredServices: ['ecommerce', 'email', 'analytics'],
    examples: [
      'Send abandoned cart emails with discount codes',
      'Recover abandoned carts automatically',
      'Create cart abandonment email sequence'
    ],
    tags: ['cart-recovery', 'email-marketing', 'conversion'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'schedule',
            name: 'Check Abandoned Carts',
            type: 'n8n-nodes-base.scheduleTrigger',
            position: [250, 300],
            parameters: {
              rule: {
                interval: [{ field: 'hours', hoursInterval: 1 }]
              }
            }
          },
          {
            id: 'get_abandoned_carts',
            name: 'Get Abandoned Carts',
            type: 'n8n-nodes-base.httpRequest',
            position: [450, 300],
            parameters: {
              method: 'GET',
              url: '{{$env.ECOMMERCE_API}}/carts/abandoned',
              queryParametersJson: '={"hours_ago": 2, "not_recovered": true}'
            }
          },
          {
            id: 'loop_carts',
            name: 'Process Each Cart',
            type: 'n8n-nodes-base.splitInBatches',
            position: [650, 300],
            parameters: {
              batchSize: 1
            }
          },
          {
            id: 'check_email_sent',
            name: 'Check If Email Sent',
            type: 'n8n-nodes-base.if',
            position: [850, 300],
            parameters: {
              conditions: {
                boolean: [
                  {
                    value1: '={{$json["recovery_email_sent"]}}',
                    operation: 'notEqual',
                    value2: true
                  }
                ]
              }
            }
          },
          {
            id: 'generate_discount',
            name: 'Generate Discount Code',
            type: 'n8n-nodes-base.code',
            position: [1050, 300],
            parameters: {
              jsCode: `
                const cart = items[0].json;
                const discountCode = 'SAVE10-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                const discountAmount = cart.total * 0.1; // 10% discount
                
                return [{
                  json: {
                    ...cart,
                    discountCode,
                    discountAmount,
                    discountPercentage: 10,
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
                  }
                }];
              `
            }
          },
          {
            id: 'send_recovery_email',
            name: 'Send Recovery Email',
            type: 'n8n-nodes-base.emailSend',
            position: [1250, 300],
            parameters: {
              fromEmail: '{{$env.COMPANY_EMAIL}}',
              toEmail: '={{$json["customer_email"]}}',
              subject: '{{$json["customer_name"]}}, you left something behind!',
              emailType: 'html',
              message: `
                <h1>Complete your purchase and save 10%!</h1>
                <p>Hi {{$json["customer_name"]}},</p>
                <p>We noticed you left some items in your cart. Don't miss out!</p>
                <h2>Your Cart:</h2>
                <ul>
                {{#each $json["items"]}}
                  <li>{{this.name}} - \${{this.price}}</li>
                {{/each}}
                </ul>
                <p><strong>Original Total: \${{$json["total"]}}</strong></p>
                <p>Use code <strong>{{$json["discountCode"]}}</strong> to get 10% off!</p>
                <p><strong>New Total: \${{$json["total"] - $json["discountAmount"]}}</strong></p>
                <a href="{{$env.SHOP_URL}}/cart?recover={{$json["cart_id"]}}&code={{$json["discountCode"]}}">Complete Purchase</a>
                <p><small>This offer expires in 48 hours</small></p>
              `
            }
          },
          {
            id: 'update_cart_status',
            name: 'Mark Email Sent',
            type: 'n8n-nodes-base.httpRequest',
            position: [1450, 300],
            parameters: {
              method: 'PATCH',
              url: '{{$env.ECOMMERCE_API}}/carts/{{$json["cart_id"]}}',
              bodyParametersJson: '={"recovery_email_sent": true, "discount_code": "{{$json["discountCode"]}}", "email_sent_at": "{{$now.toISO()}}"}'
            }
          }
        ]
      }
    }
  },
  {
    id: 'product-review-automation',
    name: 'Product Review Collection System',
    description: 'Automatically request and manage product reviews after purchase',
    keywords: ['review', 'product', 'feedback', 'rating', 'customer', 'follow-up'],
    category: 'ecommerce',
    difficulty: 'intermediate',
    requiredServices: ['ecommerce', 'email', 'review-platform'],
    examples: [
      'Send review requests after product delivery',
      'Automate product review collection',
      'Follow up for customer feedback automatically'
    ],
    tags: ['reviews', 'customer-feedback', 'post-purchase'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'delivery_trigger',
            name: 'Order Delivered',
            type: 'n8n-nodes-base.webhook',
            position: [250, 300],
            parameters: {
              path: 'order-delivered',
              responseMode: 'onReceived'
            }
          },
          {
            id: 'wait_period',
            name: 'Wait 7 Days',
            type: 'n8n-nodes-base.wait',
            position: [450, 300],
            parameters: {
              amount: 7,
              unit: 'days'
            }
          },
          {
            id: 'check_review_exists',
            name: 'Check Existing Review',
            type: 'n8n-nodes-base.httpRequest',
            position: [650, 300],
            parameters: {
              method: 'GET',
              url: '{{$env.REVIEW_API}}/reviews',
              queryParametersJson: '={"order_id": "{{$json["order_id"]}}", "customer_id": "{{$json["customer_id"]}}"}'
            }
          },
          {
            id: 'review_exists_check',
            name: 'Has Review?',
            type: 'n8n-nodes-base.if',
            position: [850, 300],
            parameters: {
              conditions: {
                number: [
                  {
                    value1: '={{$json["reviews"].length}}',
                    operation: 'equal',
                    value2: 0
                  }
                ]
              }
            }
          },
          {
            id: 'send_review_request',
            name: 'Send Review Request',
            type: 'n8n-nodes-base.emailSend',
            position: [1050, 300],
            parameters: {
              fromEmail: '{{$env.COMPANY_EMAIL}}',
              toEmail: '={{$json["customer_email"]}}',
              subject: 'How was your experience with {{$json["product_name"]}}?',
              emailType: 'html',
              message: `
                <h1>We'd love your feedback!</h1>
                <p>Hi {{$json["customer_name"]}},</p>
                <p>We hope you're enjoying your {{$json["product_name"]}}!</p>
                <p>Your opinion matters to us and helps other customers make informed decisions.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <p>Rate your purchase:</p>
                  <a href="{{$env.REVIEW_URL}}?order={{$json["order_id"]}}&rating=5">⭐⭐⭐⭐⭐</a>
                  <a href="{{$env.REVIEW_URL}}?order={{$json["order_id"]}}&rating=4">⭐⭐⭐⭐</a>
                  <a href="{{$env.REVIEW_URL}}?order={{$json["order_id"]}}&rating=3">⭐⭐⭐</a>
                </div>
                <a href="{{$env.REVIEW_URL}}?order={{$json["order_id"]}}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Write a Review</a>
                <p>As a thank you, you'll receive 15% off your next purchase!</p>
              `
            }
          }
        ]
      }
    }
  }
];