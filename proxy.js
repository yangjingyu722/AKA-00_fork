const http = require('http');
const httpProxy = require('http-proxy');

// 创建代理服务器
const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:5000',
  changeOrigin: true
});

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 添加CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 转发请求
  proxy.web(req, res, (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error');
  });
});

// 监听端口
const port = 3000;
server.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
