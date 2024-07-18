import { NextFunction, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import OrderModel, { IOrder } from "../models/order.model";

// create new order
export const newOrder = async (
  data: Partial<IOrder>,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await OrderModel.create(data);
    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// get all orders
export const getAllOrderServices = async (res: Response) => {
  const order = await OrderModel.find().sort({ createdAt: -1 });
  res.status(201).json({
    success: true,
    order,
  });
};
