import Course from "../models/Course.js";
import { CourseProgress } from "../models/courseProgress.js";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";
import Stripe from "stripe";

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Get user data
export const getUserData = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// ✅ Get enrolled courses
export const userEnrolledCourses = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const userData = await User.findById(userId).populate("enrolledCourses");
    res.json({ success: true, enrolledCourses: userData.enrolledCourses });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// ✅ Purchase course
export const purchaseCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const { origin } = req.headers;
    const userId = req.auth.userId;

    const userData = await User.findById(userId);
    const courseData = await Course.findById(courseId);

    if (!userData || !courseData) {
      return res.json({ success: false, message: "Data not found" });
    }

    // ✅ Correct discount calculation
    const amount =
      courseData.discount > 0
        ? (courseData.coursePrice -
            (courseData.discount * courseData.coursePrice) / 100).toFixed(2)
        : courseData.coursePrice.toFixed(2);

    const newPurchase = await Purchase.create({
      courseId: courseData._id,
      userId,
      amount,
      status: "pending",
    });

    const currency = process.env.CURRENCY.toLowerCase();

    const line_items = [
      {
        price_data: {
          currency,
          product_data: {
            name: courseData.courseTitle,
          },
          unit_amount: Math.floor(newPurchase.amount * 100), // convert to cents
        },
        quantity: 1,
      },
    ];

    const session = await stripeInstance.checkout.sessions.create({
      success_url: `${origin}/loading/my-enrollments`,
      cancel_url: `${origin}`,
      line_items,
      mode: "payment",
      metadata: {
        purchaseId: newPurchase._id.toString(),
      },
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// ✅ Stripe Webhooks
export const stripeWebHooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = Stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const session = await stripeInstance.checkout.sessions.list({
          payment_intent: paymentIntentId,
        });

        if (!session.data.length) break;

        const { purchaseId } = session.data[0].metadata;
        const purchaseData = await Purchase.findById(purchaseId);

        if (!purchaseData) break;

        const userData = await User.findById(purchaseData.userId);
        const courseData = await Course.findById(purchaseData.courseId);

        if (userData && courseData) {
          // ✅ push only ids
          courseData.enrolledStudents.push(userData._id);
          await courseData.save();

          userData.enrolledCourses.push(courseData._id);
          await userData.save();
        }

        purchaseData.status = "completed";
        await purchaseData.save();

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const session = await stripeInstance.checkout.sessions.list({
          payment_intent: paymentIntentId,
        });

        if (!session.data.length) break;

        const { purchaseId } = session.data[0].metadata;
        const purchaseData = await Purchase.findById(purchaseId);

        if (purchaseData) {
          purchaseData.status = "failed";
          await purchaseData.save();
        }

        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.log("Webhook handling error:", error);
    res.status(500).json({ error: error.message });
  }
};


// controller for course progress--

export const updateUserCourseProgresss = async (req,res) => {
  try {
    const userId = req.auth.userId;
    const {courseId,lectureId} = req.body;
    const progressData = await CourseProgress.findOne({userId,courseId});

    if(progressData) {
      if(progressData.lectureCompleted.includes(lectureId)) {
        return res.json({success:true,message:"Lecture Already Completed"})
      }
      progressData.lectureCompleted.push(lectureId);
      await progressData.save();
    } else{
      await CourseProgress.create({
        userId,
        courseId,
        lectureCompleted:[lectureId]
      })
    }
    res.json({success:true,message:'progress updated'})
  } catch (error) {
    console.log(error);
    res.json({success:false,message:error.message})
  }
}

export const getUserProgress = async(req,res) => {
  try {
    const userId = req.auth.userId;
    const {courseId} = req.body;
    const progressData = await CourseProgress.findOne({userId,courseId});
    res.json({success:true,progressData})
  } catch (error) {
    console.log(error);
    res.json({success:false,message:error.message})
  }
}


export const addUserRating = async (req,res) => {
  const userId = req.auth.userId;
  const {courseId,rating} = req.body;

  if(!courseId || !userId || !rating || rating < 1 || rating > 5 ) {
    return res.json({success:false,message:"Invalid Details"})
  }

  try {
    const course = await Course.findById(courseId);
    if(!course) {
      return res.json({success:false,message:'course not found'})
    }

    const user = await User.findById(userId);
    if(!user || !user.enrolledCourses.includes(courseId)) {
      return res.json({success:false,message:"user not purchased these course."})
    }

    const existingRatingIndex = course.courseRatings.findIndex(r => r.userId === userId)

    if(existingRatingIndex > -1) {
      course.courseRatings[existingRatingIndex].rating = rating;
    } else{
      course.courseRatings.push({userId,rating});
    }
    await Course.save();
    return res.json({success:true,message:'rating added'})
  } catch (error) {
    console.log(error);
    return res.json({success:false,message:error.message})
  }
}
