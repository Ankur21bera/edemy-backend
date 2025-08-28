import express from 'express';
import { addUserRating, getUserData, getUserProgress, purchaseCourse, updateUserCourseProgresss, userEnrolledCourses } from '../controllers/userController.js';


const userRouter = express.Router();

userRouter.get('/data',getUserData);
userRouter.get('/enrolled-courses',userEnrolledCourses);
userRouter.post('/purchase',purchaseCourse)


userRouter.post('/update-course-progress',updateUserCourseProgresss);
userRouter.post('/get-course-progress',getUserProgress);
userRouter.post('/add-rating',addUserRating);

export default userRouter;