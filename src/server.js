const express = require('express');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const app = express();
const port = 3000;

// Middleware to generate a nonce for each request
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
});

// Use Helmet to secure HTTP headers with custom CSP
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://cdn.simpleicons.org"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
}));

// Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to recursively get all Markdown files
const getMarkdownFiles = (dir) => {
    const result = [];
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            result.push({
                name: file,
                type: 'directory',
                children: getMarkdownFiles(filePath)
            });
        } else if (file.endsWith('.md') && !file.startsWith('h_')) {
            const data = fs.readFileSync(filePath, 'utf8');
            const firstHeaderMatch = data.match(/^#\s+(.*)/m);
            const header = firstHeaderMatch ? firstHeaderMatch[1] : file.replace('.md', '');
            result.push({
                name: header,
                type: 'file',
                path: path.relative(__dirname, filePath)
            });
        }
    });

    return result;
};

// Route to list all Markdown files
app.get('/blog', (req, res) => {
    const markdownDir = path.join(__dirname, 'blog');
    const markdownFiles = getMarkdownFiles(markdownDir);
    res.render('list', { files: markdownFiles, nonce: res.locals.nonce });
});

// Route to display Markdown content, supporting subdirectories
app.get('/blog/*', (req, res) => {
    const pagePath = req.params[0];

    // Sanitize the file path to prevent directory traversal
    if (pagePath.includes('..')) {
        return res.status(400).send('Invalid file path');
    }

    const filePath = path.join(__dirname, 'blog', `${pagePath}.md`);

    // Ensure the file is a Markdown file
    if (!filePath.endsWith('.md')) {
        return res.status(400).send('Invalid file type');
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).send('Page not found');
        }

        const htmlContent = marked(data);
        const firstHeaderMatch = data.match(/^#\s+(.*)/m);
        const title = firstHeaderMatch ? firstHeaderMatch[1] : 'Markdown Page';

        res.render('markdown', { title, content: htmlContent });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Logging middleware

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});