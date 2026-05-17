# demo react frontend App.js is in /demo-react folder

# put this in your own react frontend should show the demo

# Create image-microservice:

# Initialize Node.js project

npm init -y

# Install the dependencies

npm install express cors multer sharp uuid

# Create server.js file

touch server.js

# install nodemon as a dev dependency

npm install --save-dev nodemon

# upudate package.json

"scripts": {
"start": "node server.js",
"dev": "nodemon server.js"
},

# "npm start" to run the project
