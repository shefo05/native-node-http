const http = require('http');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream');
const path = require('path');

const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');


// PART 1: CORE MODULES (STREAMS)
// ==========================================================================

// 1. Use a readable stream to read a file in chunks and log each chunk.
function readFileInChunks(filePath) {
  const readStream = fs.createReadStream(filePath, { encoding: 'utf8'});

  readStream.on('data', (chunk) => {
    console.log('Chunk received:', chunk);
  });

  readStream.on('end', () => {
    console.log('File read successfully');
  });
}
readFileInChunks('./big.txt');

// 2. Use readable and writable streams to copy content from one file to another.
function copyFileUsingStreams(sourcePath, destPath) {
  const readStream = fs.createReadStream(sourcePath);
  const writeStream = fs.createWriteStream(destPath);

  readStream.pipe(writeStream);

  readStream.on('end', () => {
    console.log('File copied using streams');
  });
}
copyFileUsingStreams('./source.txt', './dest.txt');

// 3. Create a pipeline that reads a file, compresses it, and writes it to another file.
function compressFileUsingPipeline(sourcePath, destPath) {
  const readStream = fs.createReadStream(sourcePath);
  const gzipStream = zlib.createGzip();
  const writeStream = fs.createWriteStream(destPath);

  pipeline(
    readStream,
    gzipStream,
    writeStream,
    (err) => {
      if (err) {
        console.error('Pipeline error:', err.message);
      } else {
        console.log('File compressed successfully');
      }
    }
  );
}
compressFileUsingPipeline('./data.txt', './data.txt.gz');


// PART 2: HTTP CRUD OPERATIONS
// ==========================================================================

function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}


function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users), 'utf8');
}

function getNextId(users) {
  if (users.length === 0) return 1;
  return Math.max(...users.map(u => u.id)) + 1;
}



function sendJSONResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}



const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0]; 
  const method = req.method;



  if (method === 'POST' || method === 'PATCH') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      let parsedBody = {};
      if (body) {
        parsedBody = JSON.parse(body);
      }


      

      // 1: POST /user - Add New User
      if (method === 'POST' && pathname === '/user') {
        const { name, age, email } = parsedBody;

        if (!name || !age || !email) {
          return sendJSONResponse(res, 400, { message: 'Name, age, and email are required.' });
        }

        const users = readUsers();


        const emailExists = users.some(user => user.email === email);
        if (emailExists) {
          return sendJSONResponse(res, 400, { message: 'Email already exists.' });
        }

         const newUser = {
          id: getNextId(users),
          name,
          age,
          email
        };

        users.push(newUser);
        writeUsers(users);

        return sendJSONResponse(res, 201, { message: 'User added successfully.' });
      }

      // 2: PATCH /user/{}:id - Update User By ID
      if (method === 'PATCH' && pathname.startsWith('/user/')) {
        const userId = parseInt(pathname.split('/')[2]);
        const updates = parsedBody;

        const users = readUsers();
        const userIndex = users.findIndex(user => user.id === userId);

        if (userIndex === -1) {
          return sendJSONResponse(res, 404, { message: 'User ID not found.' });
        }

        if (updates.name !== undefined) {
          users[userIndex].name = updates.name;
        }
        if (updates.age !== undefined) {
          users[userIndex].age = updates.age;
        }
        if (updates.email !== undefined) {

          const emailExists = users.some(user => user.email === updates.email && user.id !== userId);
          if (emailExists) {
            return sendJSONResponse(res, 400, { message: 'Email already exists.' });
          }

          users[userIndex].email = updates.email;
        }

        writeUsers(users);

        const updatedFields = Object.keys(updates);
        const fieldName = updatedFields[0];
        return sendJSONResponse(res, 200, { message: `User ${fieldName} updated successfully.` });
      }
    });

    return;
  }

  // 3: DELETE /user/{}:id - Delete user by ID
  if (method === 'DELETE' && pathname.startsWith('/user/')) {
    const userId = parseInt(pathname.split('/')[2]);

    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === userId);

    if (userIndex === -1) {
      return sendJSONResponse(res, 404, { message: 'User ID not found.' });
    }

    users.splice(userIndex, 1);
    writeUsers(users);

    return sendJSONResponse(res, 200, { message: 'User deleted successfully.' });
  }

  // 4: GET /user - Get all users
  if (method === 'GET' && pathname === '/user') {
    const users = readUsers();
    return sendJSONResponse(res, 200, users);
  }

  // 5: GET /user/{}:id - Get user by ID
  if (method === 'GET' && pathname.startsWith('/user/')) {
    const userId = parseInt(pathname.split('/')[2]);

    const users = readUsers();
    const user = users.find(user => user.id === userId);

    if (!user) {
      return sendJSONResponse(res, 404, { message: 'User not found.' });
    }

    return sendJSONResponse(res, 200, user);
  }


  sendJSONResponse(res, 404, { message: 'Route not found.' });
});






server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
