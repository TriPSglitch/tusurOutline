const http = require('http');

// Тестируем polling
console.log('Testing Socket.IO polling...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/realtime/?EIO=4&transport=polling',
  method: 'GET',
  headers: {
    'Cookie': 'accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBmNmEzNWMzLWE4NjUtNDM2My04MjQ0LTA5M2Y3ZWRiYmNlMCIsImV4cGlyZXNBdCI6IjIwMjUtMTItMjVUMDg6MjQ6MTAuMTcyWiIsInR5cGUiOiJzZXNzaW9uIiwiaWF0IjoxNzY2MDQ2MjUwfQ.DhxHl3mO4JbFSwee9jhcmBcrknW9g6HAZtlTArMXQLY'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    
    // Пробуем извлечь sid для WebSocket
    const match = data.match(/"sid":"([^"]+)"/);
    if (match) {
      const sid = match[1];
      console.log('SID found:', sid);
      
      // Теперь пробуем WebSocket с этим SID
      console.log('\nTrying WebSocket upgrade...');
      testWebSocket(sid);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();

function testWebSocket(sid) {
  const wsOptions = {
    hostname: 'localhost',
    port: 3000,
    path: `/realtime/?EIO=4&transport=websocket&sid=${sid}`,
    headers: {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'Sec-WebSocket-Version': '13',
      'Cookie': 'accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBmNmEzNWMzLWE4NjUtNDM2My04MjQ0LTA5M2Y3ZWRiYmNlMCIsImV4cGlyZXNBdCI6IjIwMjUtMTItMjVUMDg6MjQ6MTAuMTcyWiIsInR5cGUiOiJzZXNzaW9uIiwiaWF0IjoxNzY2MDQ2MjUwfQ.DhxHl3mO4JbFSwee9jhcmBcrknW9g6HAZtlTArMXQLY'
    }
  };
  
  const req = http.request(wsOptions, (res) => {
    console.log('WebSocket upgrade response:', res.statusCode);
    console.log('Headers:', res.headers);
  });
  
  req.on('upgrade', (res, socket, head) => {
    console.log('WebSocket upgrade successful!');
    socket.write('2probe');
    socket.on('data', (data) => {
      console.log('WebSocket data:', data.toString());
    });
    socket.on('close', () => {
      console.log('WebSocket closed');
    });
  });
  
  req.on('error', (e) => {
    console.error('WebSocket error:', e);
  });
  
  req.end();
}