import {clerkClient} from '@clerk/express';
import {v2 as cloudinary} from 'cloudinary';
import Course from '../models/Course.js';
import Purchase from '../models/Purchase.js';
import User from '../models/User.js';




// controller for update role to educator--

export const updateRoleToEducator = async (req,res) => {
   try {
    const userId = req.auth.userId;
    await clerkClient.users.updateUserMetadata(userId,{
        publicMetadata:{
            role:'educator',
        }
    })
    res.json({success:true,message:"You Can Publish The Course Now."})
   } catch (error) {
    console.log(error);
    res.json({success:true,message:error.message})
   }
}


// controller for add new course--
export const addCourse = async(req,res) => {
    try {
        const {courseData} = req.body;
        const imageFile = req.file;
        const educatorId = req.auth.userId;

        if(!imageFile) {
            return res.json({success:false,message:"Please Attach Thumbnail"})
        }
        const parsedCourseData = await JSON.parse(courseData)
        parsedCourseData.educator = educatorId
        const newCourse = await Course.create(parsedCourseData);
        const imageUpload = await cloudinary.uploader.upload(imageFile.path)
        newCourse.courseThumbnail = imageUpload.secure_url
        await newCourse.save();

        res.json({success:true,message:"Course Added Successfully"})
    
    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }
}

// controller for get educator courses--

export const getEducatorCourses = async(req,res) => {
    try {
        const educator = req.auth.userId;
        const courses = await Course.find({educator})
        res.json({success:true,courses})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }
}

// controller for dashboard data--

export const educatorDashboardData = async(req,res) => {
    try {
        const educator = req.auth.userId;
        const courses = await Course.find({educator});
        const totalCourses = courses.length;

        const courseIds = courses.map(course => course._id);

        const purchases = await Purchase.find({
            courseId:{$in:courseIds},
            status:'completed'
        })

        const totalEarnings = purchases.reduce((sum,purchase)=>sum + purchase.amount,0);

        const enrolledStudentsData = [];
        for(const course of courses) {
            const students = await User.find({
                _id:{$in:course.enrolledStudents}
            },'name imageUrl');

            students.forEach(student => {
                enrolledStudentsData.push({
                    courseTitle:course.courseTitle,
                    student
                })
            })
        }
        res.json({success:true,dashboardData:{
            totalEarnings,enrolledStudentsData,totalCourses
        }})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }
}

// enrolled student controller--

export const getEnrolledStudentsData = async(req,res) => {
    try {
        const educator = req.auth.userId;
        const courses = await Course.find({educator});
        const courseIds = courses.map(course => course._id);

        const purchases = await Purchase.find({
            courseId:{$in:courseIds},
            status:'completed'
        }).populate('userId','name imageUrl').populate('courseId','courseTitle');

        const enrolledStudents = purchases.map(purchase => ({
            student:purchase.userId,
            courseTitle:purchase.courseId.courseTitle,
            purchaseDate:purchase.createdAt
        }))

        res.json({success:true,enrolledStudents})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }
}