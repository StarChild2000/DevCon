const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const cors = require('cors');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const userRouter = require('./routes/userRouter');
const postRouter = require('./routes/postRouter');
const jobRouter = require('./routes/jobRouter');
const reportRouter = require('./routes/reportRouter');
const viewRouter = require('./routes/viewRouter');
const messageRouter = require('./routes/messageRouter');
const roomRouter = require('./routes/roomRouter');
const projectRouter = require('./routes/projectRouter');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '/public')));

// Body Parser
app.use(express.json());

app.use(cors());

// Cookie Parser
app.use(cookieParser());

// Global Middlewares
app.use(helmet());
app.use(mongoSanitize());
//app.use(xss());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/', viewRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/posts', postRouter);
app.use('/api/v1/jobs', jobRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/messages', messageRouter);
app.use('/api/v1/rooms', roomRouter);
app.use('/api/v1/projects', projectRouter)

// handle Undefined Routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on the server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
