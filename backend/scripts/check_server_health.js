import http from 'http'; http.get('http://localhost:8080/api/auth/me', (res) => { console.log('Status:', res.statusCode); });
