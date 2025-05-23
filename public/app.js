document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // All tabs are enabled for RAG system
    const messagesContainer = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-btn');
    const documentStatsContent = document.getElementById('document-stats-content');
    const documentListContent = document.getElementById('document-list-content');
    const refreshDocsButton = document.getElementById('refresh-docs-btn');
    const documentTitleInput = document.getElementById('document-title');
    const documentContentInput = document.getElementById('document-content');
    const addDocumentButton = document.getElementById('add-document-btn');

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });

    // Chat functionality
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessageToChat(message, 'user');
        userInput.value = '';

        // Show loading indicator
        const loadingMessage = addLoadingMessage();

        try {
            // Send message to API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            
            // Remove loading indicator
            messagesContainer.removeChild(loadingMessage);
            
            // Add bot response to chat
            if (data.error) {
                addMessageToChat(data.response || "Sorry, I encountered an error. Please check your API key.", 'bot');
            } else {
                // Add the main response
                addMessageToChat(data.response, 'bot');
                
                // Add source information if available
                console.log("Sources received from server:", data.sources);
                if (data.sources && data.sources.length > 0) {
                    const sourcesMessage = document.createElement('div');
                    sourcesMessage.classList.add('message', 'bot', 'sources-message');
                    
                    const sourcesContent = document.createElement('div');
                    sourcesContent.classList.add('message-content', 'sources-content');
                    
                    const sourcesTitle = document.createElement('p');
                    sourcesTitle.classList.add('sources-title');
                    sourcesTitle.textContent = 'Sources:';
                    sourcesContent.appendChild(sourcesTitle);
                    
                    const sourcesList = document.createElement('ul');
                    sourcesList.classList.add('sources-list');
                    
                    // Create a Set to track unique references
                    const uniqueReferences = new Set();
                    
                    data.sources.forEach(source => {
                        console.log("Processing source:", source);
                        // Only add unique references
                        if (source.reference && !uniqueReferences.has(source.reference)) {
                            console.log("Adding unique reference:", source.reference);
                            uniqueReferences.add(source.reference);
                            
                            const sourceItem = document.createElement('li');
                            
                            // Create a link if it's a URL
                            if (source.reference.startsWith('http')) {
                                const link = document.createElement('a');
                                link.href = source.reference;
                                link.target = '_blank';
                                link.rel = 'noopener noreferrer';
                                link.textContent = source.reference;
                                sourceItem.appendChild(link);
                            } else {
                                sourceItem.textContent = source.reference;
                            }
                            
                            sourcesList.appendChild(sourceItem);
                        }
                    });
                    
                    sourcesContent.appendChild(sourcesList);
                    sourcesMessage.appendChild(sourcesContent);
                    messagesContainer.appendChild(sourcesMessage);
                }
            }
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            console.error('Error:', error);
            
            // Remove loading indicator
            messagesContainer.removeChild(loadingMessage);
            
            // Add error message
            addMessageToChat('Sorry, I encountered an error. Please try again.', 'bot');
        }
    }

    function addMessageToChat(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        // Process content to properly handle code blocks
        if (content.includes('[CODE_BLOCK:')) {
            // Split content by code blocks
            const parts = content.split(/(\[CODE_BLOCK:.*?\]\[\/CODE_BLOCK\])/g);
            
            parts.forEach(part => {
                if (part.startsWith('[CODE_BLOCK:')) {
                    // Extract language and code
                    const match = part.match(/\[CODE_BLOCK:(.*?)\]([\s\S]*?)\[\/CODE_BLOCK\]/);
                    if (match) {
                        const language = match[1];
                        const code = match[2];
                        
                        // Create code block container
                        const codeDiv = document.createElement('div');
                        codeDiv.classList.add('code-block-container');
                        
                        // Create pre and code elements
                        const pre = document.createElement('pre');
                        const codeElement = document.createElement('code');
                        codeElement.className = `language-${language}`;
                        codeElement.textContent = code;
                        
                        pre.appendChild(codeElement);
                        codeDiv.appendChild(pre);
                        messageContent.appendChild(codeDiv);
                    }
                } else if (part.trim()) {
                    // This is regular text
                    const textParagraph = document.createElement('p');
                    textParagraph.textContent = part;
                    messageContent.appendChild(textParagraph);
                }
            });
        } else {
            // Regular text content
            const messageParagraph = document.createElement('p');
            messageParagraph.textContent = content;
            messageContent.appendChild(messageParagraph);
        }
        
        // No need to append messageParagraph again as it's handled in the if/else blocks
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageDiv;
    }

    function addLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        const loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('loading');
        
        messageContent.appendChild(loadingSpinner);
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageDiv;
    }

    // Document management functionality
    refreshDocsButton.addEventListener('click', fetchDocuments);
    addDocumentButton.addEventListener('click', addDocument);

    // Fetch document statistics
    async function fetchDocumentStats() {
        try {
            documentStatsContent.innerHTML = '<p>Loading statistics...</p>';
            
            const response = await fetch('/api/documents');
            
            if (!response.ok) {
                throw new Error('Failed to fetch document statistics');
            }
            
            const data = await response.json();
            
            documentStatsContent.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Vector Chunks:</span>
                    <span class="stat-value">${data.documentCount || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Collection:</span>
                    <span class="stat-value">${data.collectionName || 'N/A'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Files:</span>
                    <span class="stat-value">${data.fileStats?.total || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Text Files (.txt):</span>
                    <span class="stat-value">${data.fileStats?.textFiles || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Markdown Files (.mdx):</span>
                    <span class="stat-value">${data.fileStats?.markdownFiles || 0}</span>
                </div>
            `;
        } catch (error) {
            console.error('Error:', error);
            documentStatsContent.innerHTML = '<p class="error">Failed to load document statistics</p>';
        }
    }

    // Fetch document list
    async function fetchDocuments() {
        try {
            documentListContent.innerHTML = '<p>Loading documents...</p>';
            
            const response = await fetch('/api/documents/list');
            
            if (!response.ok) {
                throw new Error('Failed to fetch documents');
            }
            
            const data = await response.json();
            
            if (data.documents && data.documents.length > 0) {
                const documentsList = document.createElement('ul');
                documentsList.classList.add('documents-list');
                
                data.documents.forEach(doc => {
                    const docItem = document.createElement('li');
                    const createdDate = new Date(doc.created).toLocaleDateString();
                    const sizeKB = (doc.size / 1024).toFixed(2);
                    
                    docItem.innerHTML = `
                        <span class="doc-name">${doc.name}</span>
                        <span class="doc-meta">
                            <span class="doc-type">${doc.type || 'Document'}</span>
                            <span class="doc-size">${sizeKB} KB</span>
                            <span class="doc-date">Created: ${createdDate}</span>
                        </span>
                    `;
                    
                    documentsList.appendChild(docItem);
                });
                
                documentListContent.innerHTML = '';
                documentListContent.appendChild(documentsList);
            } else {
                documentListContent.innerHTML = '<p>No documents found</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            documentListContent.innerHTML = '<p class="error">Failed to load documents</p>';
        }
    }

    // Add new document
    async function addDocument() {
        const title = documentTitleInput.value.trim();
        const content = documentContentInput.value.trim();
        const fileType = document.getElementById('document-type').value;
        const reference = document.getElementById('document-reference').value.trim();
        
        if (!title || !content) {
            alert('Please provide both title and content for the document');
            return;
        }
        
        // Prepare the document content with reference
        let documentContent = content;
        if (reference) {
            documentContent = `reference: ${reference}\n\n${content}`;
        }
        
        // Disable button and show loading state
        addDocumentButton.disabled = true;
        addDocumentButton.innerHTML = '<div class="loading"></div> Adding...';
        
        try {
            const response = await fetch('/api/documents/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, content: documentContent, fileType })
            });
            
            if (!response.ok) {
                throw new Error('Failed to add document');
            }
            
            const data = await response.json();
            
            if (data.success) {
                alert('Document added successfully!');
                documentTitleInput.value = '';
                documentContentInput.value = '';
                document.getElementById('document-reference').value = '';
                
                // Refresh document list and stats
                fetchDocuments();
                fetchDocumentStats();
            } else {
                alert(`Error: ${data.error || 'Failed to add document'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to add document. Please try again.');
        } finally {
            // Reset button state
            addDocumentButton.disabled = false;
            addDocumentButton.textContent = 'Add Document';
        }
    }

    // Initialize: fetch document info on page load
    fetchDocumentStats();
    fetchDocuments();
});