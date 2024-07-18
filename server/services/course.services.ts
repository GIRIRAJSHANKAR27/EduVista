import { Response,Request,NextFunction } from "express";
import CourseModel from "../models/course.model";
import { CatchAsyncError } from "../middleware/catchAsyncError";

// create course
export const createCourse = CatchAsyncError(async(data: any,res: Response)=>{
    const course = await CourseModel.create(data);
    res.status(201).json({
        success:true,
        data:course
    });
});

// get all courses
export const getAllCourseServices = async (res: Response) => {
    const course = await CourseModel.find().sort({ createdAt: -1 });
    res.status(201).json({
      success: true,
      course,
    });
  };