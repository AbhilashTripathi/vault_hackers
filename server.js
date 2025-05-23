require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

const app = express();
const port = 3002; // Use a different port to avoid conflicts

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize Gemini API
let genAI;
let geminiModel;
let vectorStore;

// Initialize RAG components
async function initializeRAG() {
  try {
    // Initialize Gemini API
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    console.log("Gemini API client initialized");
    
    // Initialize embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: "embedding-001",
    });
    
    // Load all documents from the data directory
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.txt') || file.endsWith('.mdx'));
    
    console.log(`Found ${files.length} document files to load`);
    
    // Load each file and combine the documents
    let allDocs = [];
    const documentReferences = {};
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      console.log(`Loading document: ${file}`);
      
      // Read the file content to extract reference
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const referenceMatch = fileContent.match(/^reference:\s*(https?:\/\/[^\s]+)/);
      const reference = referenceMatch ? referenceMatch[1] : null;
      
      if (reference) {
        documentReferences[filePath] = reference;
        console.log(`Found reference for ${file}: ${reference}`);
      }
      
      const loader = new TextLoader(filePath);
      const docs = await loader.load();
      
      // Add the reference to the document metadata
      if (reference) {
        docs.forEach(doc => {
          doc.metadata.reference = reference;
          doc.metadata.filename = file;
        });
      }
      
      allDocs = allDocs.concat(docs);
    }
    
    console.log(`Loaded ${allDocs.length} documents in total`);
    
    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(allDocs);
    
    // Ensure metadata is preserved in all chunks
    splitDocs.forEach(doc => {
      // Find the original document this chunk came from
      const originalDoc = allDocs.find(original =>
        doc.pageContent.includes(original.pageContent.substring(0, 50)) ||
        original.pageContent.includes(doc.pageContent.substring(0, 50))
      );
      
      if (originalDoc && originalDoc.metadata) {
        // Copy metadata from original document
        doc.metadata = { ...originalDoc.metadata };
      }
    });
    
    console.log("Sample chunk metadata:", splitDocs[0].metadata);
    console.log(`Document split into ${splitDocs.length} chunks`);
    
    // Create in-memory vector store
    vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
    
    console.log("RAG system initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing RAG system:", error);
    return false;
  }
}

// Initialize RAG on startup
initializeRAG().then(success => {
  if (success) {
    console.log("RAG system ready");
  } else {
    console.error("Failed to initialize RAG system");
  }
});

// Helper function to format code blocks in responses
function formatCodeBlocks(text) {
  // We'll use a special marker that won't be interpreted as HTML
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
    // Clean up the code and language
    code = code.trim();
    language = language.trim() || 'javascript';
    
    // Format the code with proper indentation and line breaks
    const formattedCode = code
      .split('\n')
      .map(line => line.trim())
      .join('\n');
    
    // Return a special format that will be handled by the frontend
    return `[CODE_BLOCK:${language}]${formattedCode}[/CODE_BLOCK]`;
  });
}

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!geminiModel || !vectorStore) {
      return res.status(500).json({
        error: 'RAG system not initialized. Please check your API key and configuration.',
        response: "I'm sorry, but the RAG system is not fully initialized. Please check your API key and try again."
      });
    }

    try {
      // Retrieve relevant documents based on the query
      const retriever = vectorStore.asRetriever({
        k: 3, // Number of documents to retrieve
      });
      
      const retrievedDocs = await retriever.getRelevantDocuments(message);
      
      // Extract and format the context from retrieved documents
      const context = retrievedDocs.map(doc => doc.pageContent).join('\n\n');
      
      // System prompt for RAG
      const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
      If the question cannot be answered using the context, say "I don't have enough information to answer that question."
      Do not make up information that is not in the context.
      
      When showing code examples, always format them with triple backticks and specify the language.
      Format code with proper indentation and line breaks for readability. For example:
      
      \`\`\`javascript
      bitgo
        .coin('tbld')
        .wallets()
        .generateWallet({
          label: 'My Test Wallet',
          passphrase: 'secretpassphrase1a5df8380e0e30',
        })
        .then(function (wallet) {
          // print the new wallet
          console.dir(wallet);
        });
      \`\`\`
      
      Context:
      ${context}`;
      
      // Add a delay to avoid rate limiting (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Combine context with user message
      const promptWithContext = `${systemPrompt}\n\nUser question: ${message}`;
      
      const result = await geminiModel.generateContent(promptWithContext);
      const response = await result.response;
      let text = response.text();
      
      // Format code blocks in the response
      text = formatCodeBlocks(text);

      // Log retrieved docs for debugging
      console.log("Retrieved docs metadata:", retrievedDocs.map(doc => doc.metadata));
      
      // Return response with source information
      const sources = retrievedDocs.map(doc => ({
        reference: doc.metadata.reference || 'No reference available',
        filename: doc.metadata.filename || 'Unknown file'
      }));
      
      console.log("Sources being sent to client:", sources);
      
      res.json({
        response: text,
        sources: sources,
        usage: {
          prompt_tokens: promptWithContext.length,
          completion_tokens: text.length,
          total_tokens: promptWithContext.length + text.length
        }
      });
    } catch (error) {
      console.error('Error in RAG process:', error);
      res.status(500).json({
        error: 'Failed to get response from RAG system',
        response: "I'm sorry, but I encountered an error while processing your request. This might be due to an issue with the RAG system."
      });
    }
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Endpoint to get document information
app.get('/api/documents', async (req, res) => {
  try {
    if (!vectorStore) {
      return res.status(500).json({ error: 'Vector store not initialized' });
    }
    
    // Get document count from memory vector store
    const documentCount = vectorStore._memoryVectors?.length || 0;
    
    // Get file counts by type
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir);
    const txtFiles = files.filter(file => file.endsWith('.txt')).length;
    const mdxFiles = files.filter(file => file.endsWith('.mdx')).length;
    
    res.json({
      documentCount: documentCount,
      collectionName: "in-memory-store",
      fileStats: {
        total: files.length,
        textFiles: txtFiles,
        markdownFiles: mdxFiles
      }
    });
  } catch (error) {
    console.error('Error getting document info:', error);
    res.status(500).json({ error: 'Failed to get document information' });
  }
});

// Document management endpoints
app.post('/api/documents/add', async (req, res) => {
  try {
    const { content, title, fileType } = req.body;
    
    if (!content || !title) {
      return res.status(400).json({ error: 'Content and title are required' });
    }
    
    // Determine file extension based on fileType
    const extension = fileType === 'markdown' ? 'mdx' : 'txt';
    
    // Save the document to a file
    const filename = `${title.toLowerCase().replace(/\s+/g, '_')}.${extension}`;
    const filePath = path.join(__dirname, 'data', filename);
    
    fs.writeFileSync(filePath, content);
    
    // Re-initialize RAG to include the new document
    const success = await initializeRAG();
    
    if (success) {
      res.json({ success: true, message: 'Document added successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update RAG system with new document' });
    }
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

// List all documents
app.get('/api/documents/list', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.txt') || file.endsWith('.mdx'));
    
    const documents = files.map(file => {
      const filePath = path.join(dataDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
        type: file.endsWith('.txt') ? 'Text' : 'Markdown',
        path: filePath
      };
    });
    
    res.json({ documents });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});