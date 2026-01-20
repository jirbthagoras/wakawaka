// Simple storage wrapper using localStorage
window.storage = {
  async get(key) {
    return { value: localStorage.getItem(key) };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
  },
  async delete(key) {
    localStorage.removeItem(key);
  }
};


// Configuration - Will be loaded from storage
let API_ENDPOINT = '';
let API_KEY = '';
let AWS_REGION = 'us-east-1';
let DEBUG_MODE = false;

let currentPage = 1;
let customersData = [];
let productsData = [];

// Storage keys
const STORAGE_KEYS = {
    API_ENDPOINT: 'lks_api_endpoint',
    API_KEY: 'lks_api_key',
    AWS_REGION: 'lks_aws_region',
    DEBUG_MODE: 'lks_debug_mode'
};

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    await loadConfiguration();
    checkConfiguration();
    loadDashboard();
    loadCustomers();
    loadProducts();
});

// Load configuration from storage
async function loadConfiguration() {
    try {
        // Load API Endpoint
        const endpointResult = await window.storage.get(STORAGE_KEYS.API_ENDPOINT);
        if (endpointResult && endpointResult.value) {
            API_ENDPOINT = endpointResult.value;
        }

        // Load API Key
        const keyResult = await window.storage.get(STORAGE_KEYS.API_KEY);
        if (keyResult && keyResult.value) {
            API_KEY = keyResult.value;
        }

        // Load AWS Region
        const regionResult = await window.storage.get(STORAGE_KEYS.AWS_REGION);
        if (regionResult && regionResult.value) {
            AWS_REGION = regionResult.value;
        }

        // Load Debug Mode
        const debugResult = await window.storage.get(STORAGE_KEYS.DEBUG_MODE);
        if (debugResult && debugResult.value) {
            DEBUG_MODE = debugResult.value === 'true';
        }

        if (DEBUG_MODE) {
            console.log('Configuration loaded:', {
                API_ENDPOINT: API_ENDPOINT ? '***configured***' : 'not set',
                API_KEY: API_KEY ? '***configured***' : 'not set',
                AWS_REGION
            });
        }
    } catch (error) {
        console.log('No saved configuration found, using defaults');
    }
}

// Check if configuration is complete
function checkConfiguration() {
    if (!API_ENDPOINT || !API_KEY) {
        showConfigurationWarning();
    }
}

// Show configuration warning
function showConfigurationWarning() {
    const warning = document.createElement('div');
    warning.className = 'alert alert-warning shadow-lg fixed top-20 right-4 w-96 z-50';
    warning.id = 'config-warning';
    warning.innerHTML = `
        <div>
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <h3 class="font-bold">Configuration Required</h3>
                <div class="text-xs">Please configure your API settings to use the application.</div>
            </div>
        </div>
        <button class="btn btn-sm btn-warning" onclick="showSettings()">Configure Now</button>
    `;
    
    document.body.appendChild(warning);
}

// Tab management
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(btn => btn.classList.remove('tab-active'));
    event.target.classList.add('tab-active');
    
    // Load data when switching to specific tabs
    if (tabName === 'orders') {
        loadOrders();
    } else if (tabName === 'dashboard') {
        loadDashboard();
    }
}

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    // Check if API is configured
    if (!API_ENDPOINT || !API_KEY) {
        showToast('API not configured. Please go to Settings.', 'error');
        throw new Error('API not configured');
    }

    const startTime = Date.now();
    
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': API_KEY
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const url = `${API_ENDPOINT}${endpoint}`;
        
        if (DEBUG_MODE) {
            console.log(`API Call: ${method} ${url}`, body ? { body } : '');
        }
        
        const response = await fetch(url, options);
        const responseTime = Date.now() - startTime;
        
        // Update API response time
        const responseTimeEl = document.getElementById('api-response-time');
        if (responseTimeEl) {
            responseTimeEl.textContent = `${responseTime}ms`;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        logActivity(`API ${method} ${endpoint} - Success (${responseTime}ms)`);
        
        if (DEBUG_MODE) {
            console.log('API Response:', data);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        logActivity(`API ${method} ${endpoint} - Failed: ${error.message}`, 'error');
        showToast('API Error: ' + error.message, 'error');
        throw error;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const data = await apiCall('/orders?limit=100');
        
        // Calculate stats
        const orders = data.orders || [];
        const totalOrders = data.pagination?.total || orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        
        // Update stats
        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('total-revenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('pending-orders').textContent = pendingOrders;
        document.getElementById('completed-orders').textContent = completedOrders;
        
        // Recent orders
        const recentOrders = orders.slice(0, 5);
        const tableBody = document.getElementById('recent-orders-table');
        
        if (recentOrders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No orders found</td></tr>';
        } else {
            tableBody.innerHTML = recentOrders.map(order => `
                <tr>
                    <td><span class="font-mono text-xs">${order.order_id.substring(0, 8)}...</span></td>
                    <td>${order.customer_name || 'N/A'}</td>
                    <td>${new Date(order.order_date).toLocaleDateString()}</td>
                    <td><span class="badge badge-${getStatusColor(order.status)}">${order.status}</span></td>
                    <td>$${(order.total_amount || 0).toFixed(2)}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Orders
async function loadOrders() {
    try {
        const data = await apiCall(`/orders?page=${currentPage}&limit=10`);
        const orders = data.orders || [];
        
        const tableBody = document.getElementById('orders-table');
        
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';
        } else {
            tableBody.innerHTML = orders.map(order => `
                <tr>
                    <td><span class="font-mono text-xs">${order.order_id.substring(0, 8)}...</span></td>
                    <td>${order.customer_name || 'N/A'}</td>
                    <td>${order.email || 'N/A'}</td>
                    <td>${new Date(order.order_date).toLocaleDateString()}</td>
                    <td><span class="badge badge-${getStatusColor(order.status)}">${order.status}</span></td>
                    <td>$${(order.total_amount || 0).toFixed(2)}</td>
                    <td>
                        <div class="join">
                            <button class="btn btn-xs btn-info join-item" onclick="viewOrder('${order.order_id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-xs btn-warning join-item" onclick="updateOrderStatus('${order.order_id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-xs btn-error join-item" onclick="deleteOrder('${order.order_id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        // Update pagination
        document.getElementById('current-page').textContent = currentPage;
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function viewOrder(orderId) {
    try {
        const order = await apiCall(`/orders/${orderId}`);
        
        const content = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="font-semibold">Order ID:</p>
                        <p class="font-mono text-sm">${order.order_id}</p>
                    </div>
                    <div>
                        <p class="font-semibold">Status:</p>
                        <span class="badge badge-${getStatusColor(order.status)}">${order.status}</span>
                    </div>
                    <div>
                        <p class="font-semibold">Customer:</p>
                        <p>${order.customer_name}</p>
                    </div>
                    <div>
                        <p class="font-semibold">Email:</p>
                        <p>${order.email}</p>
                    </div>
                    <div>
                        <p class="font-semibold">Order Date:</p>
                        <p>${new Date(order.order_date).toLocaleString()}</p>
                    </div>
                    <div>
                        <p class="font-semibold">Total Amount:</p>
                        <p class="text-lg font-bold">$${(order.total_amount || 0).toFixed(2)}</p>
                    </div>
                </div>
                
                <div class="divider">Order Items</div>
                
                <div class="overflow-x-auto">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Price</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(item => `
                                <tr>
                                    <td>${item.product_name}</td>
                                    <td>${item.quantity}</td>
                                    <td>$${item.price.toFixed(2)}</td>
                                    <td>$${(item.quantity * item.price).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('order-detail-content').innerHTML = content;
        document.getElementById('order-detail-modal').showModal();
    } catch (error) {
        console.error('Error viewing order:', error);
    }
}

async function updateOrderStatus(orderId) {
    const newStatus = prompt('Enter new status (pending/processing/completed/cancelled):');
    if (!newStatus) return;
    
    try {
        await apiCall(`/orders/${orderId}`, 'PUT', { status: newStatus });
        showToast('Order status updated successfully', 'success');
        loadOrders();
    } catch (error) {
        console.error('Error updating order:', error);
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
        await apiCall(`/orders/${orderId}`, 'DELETE');
        showToast('Order deleted successfully', 'success');
        loadOrders();
    } catch (error) {
        console.error('Error deleting order:', error);
    }
}

function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    loadOrders();
}

// Create Order
async function loadCustomers() {
    // In production, this would call an API endpoint
    // For now, using mock data
    customersData = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
        { id: '3', name: 'Bob Johnson', email: 'bob@example.com' }
    ];
    
    const select = document.getElementById('customer-select');
    select.innerHTML = '<option value="">Select Customer</option>' +
        customersData.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('');
}

async function loadProducts() {
    // In production, this would call an API endpoint
    productsData = [
        { id: '1', name: 'Laptop', price: 999.99 },
        { id: '2', name: 'Mouse', price: 29.99 },
        { id: '3', name: 'Keyboard', price: 79.99 },
        { id: '4', name: 'Monitor', price: 299.99 },
        { id: '5', name: 'Headphones', price: 149.99 }
    ];
    
    updateProductSelects();
}

function updateProductSelects() {
    const selects = document.querySelectorAll('.product-select');
    const options = '<option value="">Select Product</option>' +
        productsData.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} - $${p.price}</option>`).join('');
    
    selects.forEach(select => {
        select.innerHTML = options;
        select.addEventListener('change', updateItemPrice);
    });
}

function updateItemPrice(event) {
    const select = event.target;
    const selectedOption = select.options[select.selectedIndex];
    const price = selectedOption.dataset.price || 0;
    
    const itemDiv = select.closest('.order-item');
    const priceDisplay = itemDiv.querySelector('.price-display');
    priceDisplay.value = `$${parseFloat(price).toFixed(2)}`;
    
    calculateTotal();
}

function addOrderItem() {
    const itemsContainer = document.getElementById('order-items');
    const newItem = document.querySelector('.order-item').cloneNode(true);
    
    // Reset values
    newItem.querySelector('.product-select').value = '';
    newItem.querySelector('.quantity-input').value = 1;
    newItem.querySelector('.price-display').value = '';
    
    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-error btn-sm mt-8';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = function() {
        newItem.remove();
        calculateTotal();
    };
    newItem.appendChild(removeBtn);
    
    itemsContainer.appendChild(newItem);
    updateProductSelects();
}

function calculateTotal() {
    let total = 0;
    const items = document.querySelectorAll('.order-item');
    
    items.forEach(item => {
        const select = item.querySelector('.product-select');
        const quantity = parseFloat(item.querySelector('.quantity-input').value) || 0;
        const selectedOption = select.options[select.selectedIndex];
        const price = parseFloat(selectedOption.dataset.price) || 0;
        
        total += quantity * price;
    });
    
    document.getElementById('order-total').textContent = total.toFixed(2);
}

document.addEventListener('input', function(e) {
    if (e.target.classList.contains('quantity-input')) {
        calculateTotal();
    }
});

async function createOrder(event) {
    event.preventDefault();
    
    const customerId = document.getElementById('customer-select').value;
    if (!customerId) {
        showToast('Please select a customer', 'error');
        return;
    }
    
    const items = [];
    const orderItems = document.querySelectorAll('.order-item');
    
    orderItems.forEach(item => {
        const select = item.querySelector('.product-select');
        const productId = select.value;
        const quantity = parseInt(item.querySelector('.quantity-input').value);
        const selectedOption = select.options[select.selectedIndex];
        const price = parseFloat(selectedOption.dataset.price);
        
        if (productId && quantity > 0) {
            items.push({ product_id: productId, quantity, price });
        }
    });
    
    if (items.length === 0) {
        showToast('Please add at least one item', 'error');
        return;
    }
    
    try {
        const result = await apiCall('/orders', 'POST', {
            customer_id: customerId,
            items: items
        });
        
        showToast('Order created successfully!', 'success');
        document.getElementById('create-order-form').reset();
        document.getElementById('order-total').textContent = '0.00';
        
        // Switch to orders tab
        showTab('orders');
        loadOrders();
    } catch (error) {
        console.error('Error creating order:', error);
    }
}

// Reports
function generateReport(type) {
    showToast(`Generating ${type} report...`, 'info');
    logActivity(`Report generation started: ${type}`);
    
    // In production, this would trigger Lambda function
    setTimeout(() => {
        showToast('Report generated successfully!', 'success');
        logActivity(`Report generated: ${type}`);
    }, 2000);
}

// Utilities
function getStatusColor(status) {
    const colors = {
        'pending': 'warning',
        'processing': 'info',
        'completed': 'success',
        'cancelled': 'error',
        'failed': 'error'
    };
    return colors[status] || 'ghost';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg fixed top-4 right-4 w-96 z-50`;
    toast.innerHTML = `
        <div>
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function logActivity(message, type = 'info') {
    const log = document.getElementById('activity-log');
    const time = new Date().toLocaleTimeString();
    
    const item = document.createElement('li');
    item.innerHTML = `
        <div class="timeline-start">${time}</div>
        <div class="timeline-middle">
            <i class="fas fa-circle text-xs text-${type === 'error' ? 'error' : 'success'}"></i>
        </div>
        <div class="timeline-end timeline-box">${message}</div>
        <hr/>
    `;
    
    log.insertBefore(item, log.firstChild);
    
    // Keep only last 20 items
    while (log.children.length > 20) {
        log.removeChild(log.lastChild);
    }
}

function refreshData() {
    showToast('Refreshing data...', 'info');
    loadDashboard();
    loadOrders();
}

// Settings Management
async function showSettings() {
    // Remove warning if exists
    const warning = document.getElementById('config-warning');
    if (warning) {
        warning.remove();
    }

    // Load current settings
    try {
        document.getElementById('settings-api-endpoint').value = API_ENDPOINT || '';
        document.getElementById('settings-api-key').value = API_KEY || '';
        document.getElementById('settings-aws-region').value = AWS_REGION || 'us-east-1';
        document.getElementById('settings-debug-mode').checked = DEBUG_MODE || false;
        
        updateConfigStatus();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    
    document.getElementById('settings-modal').showModal();
}

function closeSettings() {
    document.getElementById('settings-modal').close();
}

function updateConfigStatus() {
    const statusEl = document.getElementById('config-status');
    const endpoint = document.getElementById('settings-api-endpoint').value;
    const key = document.getElementById('settings-api-key').value;
    
    if (endpoint && key) {
        statusEl.textContent = 'Configured ✓';
        statusEl.className = 'font-bold text-success';
    } else {
        statusEl.textContent = 'Not Configured';
        statusEl.className = 'font-bold text-error';
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('settings-api-key');
    const btn = document.getElementById('toggle-api-key-btn');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

async function saveSettings() {
    const endpoint = document.getElementById('settings-api-endpoint').value.trim();
    const key = document.getElementById('settings-api-key').value.trim();
    const region = document.getElementById('settings-aws-region').value;
    const debug = document.getElementById('settings-debug-mode').checked;
    
    // Clear previous errors
    document.getElementById('api-endpoint-error').textContent = '';
    document.getElementById('api-key-error').textContent = '';
    
    // Validation
    let hasError = false;
    
    if (!endpoint) {
        document.getElementById('api-endpoint-error').textContent = 'Required';
        hasError = true;
    } else if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        document.getElementById('api-endpoint-error').textContent = 'Must start with http:// or https://';
        hasError = true;
    }
    
    if (!key) {
        document.getElementById('api-key-error').textContent = 'Required';
        hasError = true;
    }
    
    if (hasError) {
        showToast('Please fix the validation errors', 'error');
        return;
    }
    
    try {
        // Save to storage
        await window.storage.set(STORAGE_KEYS.API_ENDPOINT, endpoint);
        await window.storage.set(STORAGE_KEYS.API_KEY, key);
        await window.storage.set(STORAGE_KEYS.AWS_REGION, region);
        await window.storage.set(STORAGE_KEYS.DEBUG_MODE, debug.toString());
        
        // Update global variables
        API_ENDPOINT = endpoint;
        API_KEY = key;
        AWS_REGION = region;
        DEBUG_MODE = debug;
        
        showToast('Settings saved successfully!', 'success');
        closeSettings();
        
        // Remove warning if exists
        const warning = document.getElementById('config-warning');
        if (warning) {
            warning.remove();
        }
        
        // Refresh dashboard
        loadDashboard();
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings: ' + error.message, 'error');
    }
}

async function testApiConnection() {
    const endpoint = document.getElementById('settings-api-endpoint').value.trim();
    const key = document.getElementById('settings-api-key').value.trim();
    
    if (!endpoint || !key) {
        showToast('Please enter API Endpoint and API Key first', 'error');
        return;
    }
    
    const btn = document.getElementById('test-connection-btn');
    const resultDiv = document.getElementById('connection-test-result');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading loading-spinner"></span>Testing...';
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${endpoint}/orders?limit=1`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': key
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        resultDiv.classList.remove('hidden');
        
        if (response.ok) {
            resultDiv.className = 'alert alert-success text-sm mt-2';
            resultDiv.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <div>
                    <p><strong>Connection Successful!</strong></p>
                    <p class="text-xs">Response time: ${responseTime}ms | Status: ${response.status}</p>
                </div>
            `;
        } else {
            const errorText = await response.text();
            resultDiv.className = 'alert alert-error text-sm mt-2';
            resultDiv.innerHTML = `
                <i class="fas fa-times-circle"></i>
                <div>
                    <p><strong>Connection Failed</strong></p>
                    <p class="text-xs">Status: ${response.status} | ${errorText.substring(0, 100)}</p>
                </div>
            `;
        }
    } catch (error) {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'alert alert-error text-sm mt-2';
        resultDiv.innerHTML = `
            <i class="fas fa-times-circle"></i>
            <div>
                <p><strong>Connection Error</strong></p>
                <p class="text-xs">${error.message}</p>
            </div>
        `;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plug mr-2"></i>Test API Connection';
    }
}

async function clearAllSettings() {
    if (!confirm('Are you sure you want to clear all settings? This cannot be undone.')) {
        return;
    }
    
    try {
        await window.storage.delete(STORAGE_KEYS.API_ENDPOINT);
        await window.storage.delete(STORAGE_KEYS.API_KEY);
        await window.storage.delete(STORAGE_KEYS.AWS_REGION);
        await window.storage.delete(STORAGE_KEYS.DEBUG_MODE);
        
        // Reset global variables
        API_ENDPOINT = '';
        API_KEY = '';
        AWS_REGION = 'us-east-1';
        DEBUG_MODE = false;
        
        // Clear form
        document.getElementById('settings-api-endpoint').value = '';
        document.getElementById('settings-api-key').value = '';
        document.getElementById('settings-aws-region').value = 'us-east-1';
        document.getElementById('settings-debug-mode').checked = false;
        
        updateConfigStatus();
        
        showToast('All settings cleared', 'success');
        closeSettings();
        
        // Show warning again
        showConfigurationWarning();
    } catch (error) {
        console.error('Error clearing settings:', error);
        showToast('Failed to clear settings: ' + error.message, 'error');
    }
}