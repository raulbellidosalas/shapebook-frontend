// API Base URL - Ajusta según tu configuración
const API_BASE_URL = 'http://localhost:3000/api';

// State management
let currentUser = null;
let posts = [];
let categories = [];
let notifications = [];
let messages = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  // Try to load user from localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserInterface();
    }

    loadCategories();
    loadPosts();
    loadMessages();
    setupEventListeners();
    
    // Simulate some initial data
    loadMockData();
});

// Setup event listeners
function setupEventListeners() {
    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('createPostForm').addEventListener('submit', handleCreatePost);
    document.getElementById('editPostForm')?.addEventListener('submit', handleEditPost); 
    // Chat input
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const query = e.target.value;
        if (query.length > 2) {
            searchPosts(query);
        } else if (query.length === 0) {
            loadPosts();
        }
    });
}

// API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(currentUser && { 'Authorization': `Bearer ${currentUser.token}` })
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Error de conexión con el servidor', 'error');
        return null;
    }
}

// Update your authentication handler to properly store user data
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await apiRequest('/users/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response && response.user) {
            // Ensure we store all necessary user data including _id
            currentUser = {
                ...response.user,
                token: response.token,
                _id: response.user._id || response.user.id // Handle both cases
            };
            localStorage.setItem('user', JSON.stringify(currentUser)); // Persist session
            updateUserInterface();
            closeModal('loginModal');
            showNotification('Sesión iniciada', 'success');
        }
    } catch (error) {
        showNotification('Credenciales incorrectas', 'error');
    }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  
  try {
    const response = await apiRequest('/users/register', {
      method: 'POST',
      body: JSON.stringify({ 
        username, 
        email, 
        password // Mismo nombre que en el modelo
      })
    });
    
    if (response) {
      closeModal('registerModal');
      showNotification('Cuenta creada exitosamente', 'success');
    }
  } catch (error) {
    showNotification(error.error || 'Error al registrar', 'error');
  }
}

// Posts
// Updated loadPosts function with proper error handling and rendering
async function loadPosts() {
    try {
        // Clear previous posts while loading
        document.getElementById('postsContainer').innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading posts...</p>
            </div>
        `;

        // Fetch posts from your API
        const response = await apiRequest('/posts');
        
        if (response && Array.isArray(response)) {
            posts = response;
            renderPosts(posts);
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        
        // Show error message in the UI
        document.getElementById('postsContainer').innerHTML = `
            <div class="error-message">
                <p>Failed to load posts. Please try again later.</p>
                <button onclick="loadPosts()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

// Updated handleCreatePost function
async function handleCreatePost(e) {
    e.preventDefault();
    
    // Get form values with proper null checks
    const title = document.getElementById('postTitle')?.value.trim();
    const content = document.getElementById('postContent')?.value.trim();
    const category = document.getElementById('postCategory')?.value.trim() || undefined;
    const tags = document.getElementById('postTags')?.value.split(',').map(tag => tag.trim()).filter(tag => tag) || [];

    // Validate required fields
    if (!title || !content) {
        showNotification('Título y contenido son requeridos', 'warning');
        return;
    }

    // Check authentication
    if (!currentUser || !currentUser._id) {
        showNotification('Debes iniciar sesión para crear un post', 'warning');
        showModal('loginModal');
        return;
    }

    try {
        console.log('Current User ID:', currentUser._id); // Debug log
        
        const response = await apiRequest('/posts/posts', { // Changed to match your backend route
            method: 'POST',
            body: JSON.stringify({
                title,
                content,
                author: currentUser._id, // Use _id which matches your MongoDB model
                ...(category && { category }), // Only include if exists
                tags // Already filtered empty tags
            })
        });

        if (response) {
            closeModal('createPostModal');
            document.getElementById('createPostForm')?.reset();
            loadPosts();
            showNotification('Post creado exitosamente', 'success');
        }
    } catch (error) {
        console.error('Full error creating post:', error);
        showNotification(`Error al crear el post: ${error.message}`, 'error');
    }
}

// Enhanced renderPosts function with category support
function renderPosts(postsToRender) {
    const container = document.getElementById('postsContainer');
    
    if (!postsToRender || postsToRender.length === 0) {
        container.innerHTML = `
            <div class="post-card empty-state">
                <p>No posts available yet. Be the first to create one!</p>
                ${currentUser ? `<button onclick="showModal('createPostModal')" class="btn btn-primary">Create Post</button>` : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = postsToRender.map(post => `
        <article class="post-card" data-id="${post._id}">
            <div class="post-header">
                <div>
                    <h3 class="post-title">${post.title}</h3>
                    <div class="post-meta">
                        <span class="author">${post.author?.username || 'Anonymous'}</span>
                        <span>•</span>
                        <time datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
                        ${post.category ? `
                            <span>•</span>
                            <span class="category-tag">${post.category.name || post.category}</span>
                        ` : ''}
                        ${post.tags?.length > 0 ? `
                            <span>•</span>
                            <div class="tags">
                                ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                ${currentUser?._id === post.author?._id ? `
                    <div class="post-actions">
                        <button onclick="editPost('${post._id}')" class="btn-icon">✏️</button>
                        <button onclick="deletePost('${post._id}')" class="btn-icon">🗑️</button>
                    </div>
                ` : ''}
            </div>
            <div class="post-content">
                ${post.content}
            </div>
            <div class="post-stats">
                <span class="stat-item">
                    👁️ ${post.viewCount || 0} views
                </span>
                <span class="stat-item">
                    💬 ${post.comments?.length || 0} comments
                </span>
                <span class="stat-item">
                    👍 ${post.likes?.length || 0} likes
                </span>
            </div>
        </article>
    `).join('');
}


// Edit Post Function
async function editPost(postId) {
  try {
    // First fetch the post to edit
    const post = await apiRequest(`/posts/${postId}`);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check if current user is the author
    if (currentUser?._id !== post.author?._id) {
      showNotification('Solo el autor puede editar este post', 'warning');
      return;
    }

    // Fill the edit form (assuming you have an edit modal similar to create)
    document.getElementById('editPostId').value = post._id;
    document.getElementById('editPostTitle').value = post.title;
    document.getElementById('editPostContent').value = post.content;
    document.getElementById('editPostCategory').value = post.category?._id || '';
    document.getElementById('editPostTags').value = post.tags?.join(', ') || '';
    
    // Show the edit modal
    showModal('editPostModal');
  } catch (error) {
    console.error('Error loading post for edit:', error);
    showNotification('Error al cargar el post para editar', 'error');
  }
}

// Handle Edit Form Submission
async function handleEditPost(e) {
  e.preventDefault();
  
  const postId = document.getElementById('editPostId').value;
  const title = document.getElementById('editPostTitle').value.trim();
  const content = document.getElementById('editPostContent').value.trim();
  const category = document.getElementById('editPostCategory').value.trim() || undefined;
  const tags = document.getElementById('editPostTags').value.split(',').map(tag => tag.trim()).filter(tag => tag) || [];

  if (!title || !content) {
    showNotification('Título y contenido son requeridos', 'warning');
    return;
  }

  try {
    const response = await apiRequest(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        content,
        category,
        tags
      })
    });

    if (response) {
      closeModal('editPostModal');
      loadPosts();
      showNotification('Post actualizado exitosamente', 'success');
    }
  } catch (error) {
    console.error('Error updating post:', error);
    showNotification('Error al actualizar el post', 'error');
  }
}

// Delete Post Function
async function deletePost(postId) {
  // Confirm before deleting
  if (!confirm('¿Estás seguro que deseas eliminar este post?')) {
    return;
  }

  try {
    // Check if the post belongs to current user
    const post = await apiRequest(`/posts/${postId}`);
    if (!post) {
      throw new Error('Post not found');
    }

    if (currentUser?._id !== post.author?._id) {
      showNotification('Solo el autor puede eliminar este post', 'warning');
      return;
    }

    // Proceed with deletion
    const response = await apiRequest(`/posts/${postId}`, {
      method: 'DELETE'
    });

    if (response) {
      showNotification('Post eliminado exitosamente', 'success');
      loadPosts(); // Refresh the post list
    }
  } catch (error) {
    console.error('Error deleting post:', error);
    showNotification('Error al eliminar el post', 'error');
  }
}




// Categories
async function loadCategories() {
    try {
        const response = await apiRequest('/categories');
        if (response) {
            categories = response.categories || [];
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function filterByCategory(category) {
    const filteredPosts = posts.filter(post => 
        post.category.toLowerCase() === category.toLowerCase()
    );
    renderPosts(filteredPosts);
}

// Chat
async function loadMessages() {
    try {
        const response = await apiRequest('/messages');
        if (response) {
            messages = response.messages || [];
            renderMessages(messages);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!currentUser) {
        showNotification('Debes iniciar sesión para enviar mensajes', 'warning');
        return;
    }
    
    try {
        const response = await apiRequest('/messages', {
            method: 'POST',
            body: JSON.stringify({
                content: message,
                sender: currentUser.id
            })
        });
        
        if (response) {
            input.value = '';
            loadMessages();
        }
    } catch (error) {
        showNotification('Error al enviar mensaje', 'error');
    }
}

function renderMessages(messagesToRender) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = messagesToRender.map(message => `
        <div class="message">
            <div class="message-author">${message.sender?.username || 'Usuario'}</div>
            <div class="message-text">${message.content}</div>
        </div>
    `).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Search
function searchPosts(query) {
    if (!query) {
        loadPosts();
        return;
    }
    
    const filteredPosts = posts.filter(post => 
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.content.toLowerCase().includes(query.toLowerCase())
    );
    renderPosts(filteredPosts);
}

// UI Functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showSection(section) {
    // Update active nav
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Here you could implement section switching logic
    console.log('Switching to section:', section);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function updateUserInterface() {
    const userActions = document.querySelector('.user-actions');
    if (currentUser) {
        userActions.innerHTML = `
            <span class="user-badge premium-badge">
                ⭐ ${currentUser.username}
            </span>
            <button class="btn btn-secondary" onclick="logout()">Cerrar Sesión</button>
        `;
    } else {
        userActions.innerHTML = `
            <button class="btn btn-secondary" onclick="showModal('loginModal')">Iniciar Sesión</button>
            <button class="btn btn-primary" onclick="showModal('registerModal')">Registrarse</button>
        `;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('user');
    updateUserInterface();
    showNotification('Sesión cerrada', 'success');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d`;
    
    return date.toLocaleDateString('es-ES');
}

// Mock data for demonstration
function loadMockData() {
    // Mock posts
    posts = [
        {
            id: 1,
            title: "¿Cuál es el mejor framework para desarrollo web en 2025?",
            content: "He estado investigando sobre los frameworks más populares para desarrollo web este año. React sigue siendo muy popular, pero he visto que Vue.js y Svelte están ganando terreno. ¿Qué opinan ustedes? ¿Cuál recomendarían para un proyecto nuevo?",
            category: "programacion",
            author: { username: "DevMaster", id: 1 },
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            likes: 15,
            comments: [{ id: 1 }, { id: 2 }],
            views: 234
        },
        {
            id: 2,
            title: "Implementación de IA en aplicaciones móviles",
            content: "Estoy trabajando en una app que necesita integrar funciones de IA para reconocimiento de imágenes. ¿Alguien ha trabajado con TensorFlow Lite o Core ML? Me gustaría conocer sus experiencias y mejores prácticas.",
            category: "ia",
            author: { username: "AIEnthusiast", id: 2 },
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            likes: 8,
            comments: [{ id: 3 }],
            views: 156
        },
        {
            id: 3,
            title: "Migración a la nube: AWS vs Azure vs Google Cloud",
            content: "Mi empresa está considerando migrar nuestra infraestructura a la nube. Hemos estado evaluando AWS, Azure y Google Cloud Platform. ¿Cuáles son sus experiencias con estas plataformas? ¿Qué factores debería considerar para tomar la mejor decisión?",
            category: "cloud",
            author: { username: "CloudArchitect", id: 3 },
            createdAt: new Date(Date.now() - 10800000).toISOString(),
            likes: 22,
            comments: [{ id: 4 }, { id: 5 }, { id: 6 }],
            views: 89
        },
        {
            id: 4,
            title: "Optimización de rendimiento en aplicaciones React Native",
            content: "He notado que mi aplicación React Native tiene problemas de rendimiento en dispositivos más antiguos. ¿Qué técnicas de optimización recomiendan? He probado con lazy loading y memo, pero busco más estrategias.",
            category: "mobile",
            author: { username: "MobileDev", id: 4 },
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            likes: 12,
            comments: [{ id: 7 }],
            views: 178
        },
        {
            id: 5,
            title: "Nuevo procesador M4 de Apple: ¿Vale la pena la actualización?",
            content: "Apple acaba de anunciar el M4 y estoy considerando actualizar mi MacBook Pro. ¿Alguien ya ha tenido la oportunidad de probarlo? ¿Qué mejoras han notado en términos de rendimiento para desarrollo?",
            category: "hardware",
            author: { username: "TechReviewer", id: 5 },
            createdAt: new Date(Date.now() - 18000000).toISOString(),
            likes: 31,
            comments: [{ id: 8 }, { id: 9 }],
            views: 445
        }
    ];

    // Mock messages
    messages = [
        {
            id: 1,
            content: "¡Hola a todos! ¿Cómo están?",
            sender: { username: "DevMaster", id: 1 },
            createdAt: new Date(Date.now() - 300000).toISOString()
        },
        {
            id: 2,
            content: "Muy bien, trabajando en un proyecto interesante 🚀",
            sender: { username: "AIEnthusiast", id: 2 },
            createdAt: new Date(Date.now() - 240000).toISOString()
        },
        {
            id: 3,
            content: "¿Alguien ha probado el nuevo framework que salió?",
            sender: { username: "CloudArchitect", id: 3 },
            createdAt: new Date(Date.now() - 180000).toISOString()
        },
        {
            id: 4,
            content: "Sí, lo probé ayer. Muy prometedor 👍",
            sender: { username: "MobileDev", id: 4 },
            createdAt: new Date(Date.now() - 120000).toISOString()
        },
        {
            id: 5,
            content: "¿Podrían compartir el link?",
            sender: { username: "TechReviewer", id: 5 },
            createdAt: new Date(Date.now() - 60000).toISOString()
        }
    ];

    // Render initial data
    renderPosts(posts);
    renderMessages(messages);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Simulate real-time updates
setInterval(() => {
    if (Math.random() > 0.7) {
        const newMessage = {
            id: Date.now(),
            content: getRandomMessage(),
            sender: { username: getRandomUsername(), id: Math.floor(Math.random() * 100) },
            createdAt: new Date().toISOString()
        };
        messages.push(newMessage);
        renderMessages(messages);
    }
}, 10000);

function getRandomMessage() {
    const messages = [
        "¡Excelente discusión!",
        "¿Alguien ha trabajado con GraphQL?",
        "Muy interesante el último post sobre IA",
        "¿Recomendaciones para aprender Rust?",
        "El evento de la próxima semana se ve genial",
        "¿Opiniones sobre el nuevo MacBook?",
        "Kubernetes está cambiando todo 🚀",
        "¿Alguien más está siguiendo el desarrollo de WebAssembly?"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function getRandomUsername() {
    const usernames = [
        "CodeNinja", "DataScientist", "FullStackDev", "UIDesigner", 
        "DevOpsGuru", "CyberSecExpert", "BlockchainDev", "MLEngineer"
    ];
    return usernames[Math.floor(Math.random() * usernames.length)];
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
});