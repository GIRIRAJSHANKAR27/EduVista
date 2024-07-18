require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import exp from "constants";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { createWatchCompilerHost, isAwaitKeyword } from "typescript";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { json } from "stream/consumers";
import {
  getAllUsersServices,
  getUserById,
  updateUserRoleServices,
} from "../services/user.services";
import mongoose from "mongoose";
import cloudinary from "cloudinary";

// Register user
interface IResgistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const isEmailExists = await userModel.findOne({ email });
      if (isEmailExists) {
        return next(new ErrorHandler("Email already exists", 400));
      }

      const user: IResgistrationBody = {
        name,
        email,
        password,
      };

      const activationToken = createActivationToken(user);

      const activationCode = activationToken.activationCode;

      const data = { user: { name: user.name }, activationCode };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-email.ejs"),
        data
      );

      try {
        await sendMail({
          email: user.email,
          subject: "Activate your account",
          template: "activation-email.ejs",
          data,
        });

        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.email} to activate your account!`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );

  return { token, activationCode };
};

// Activate user
interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });

      if (existUser) {
        return next(new ErrorHandler("Email already exist", 400));
      }

      const user = await userModel.create({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Login User
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;

      if (!email || !password) {
        return next(
          new ErrorHandler("Please Enter the email and password", 400)
        );
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// logout User
export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refersh_token", "", { maxAge: 1 });

      // const userId = req.user?._id || "";
      // redis.del(userId);

      const userId = req.user?._id ? req.user._id.toString() : "";
      if (userId) {
        await redis.del(userId);
      }

      res.status(200).json({
        success: true,
        message: "Logged out succesfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update access token
// export const updateAccessToken = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const refresh_token = req.cookies.refersh_token as string;
//       const decoded = jwt.verify(
//         refresh_token,
//         process.env.REFRESH_TOKEN as string
//       ) as JwtPayload;

//       const message = "could not refresh token";
//       if (!decoded) {
//         return next(new ErrorHandler(message, 400));
//       }
//       const session = await redis.get(decoded._id as string);

//       if (!session) {
//         return next(new ErrorHandler(message, 400));
//       }

//       const user = JSON.parse(session);

//       const accessToken = jwt.sign(
//         { id: user._id },
//         process.env.ACCESS_TOKEN as string,
//         {
//           expiresIn: "5m",
//         }
//       );

//       const refreshToken = jwt.sign(
//         { id: user._id },
//         process.env.REFRESH_TOKEN as string,
//         {
//           expiresIn: "3d",
//         }
//       );

//       res.cookie("access_token",accessToken,accessTokenOptions);
//       res.cookie("refresh_token",refreshToken,refreshTokenOptions);

//       res.status(200).json({
//         status: "success",
//         accessToken,
//       })

//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 400));
//     }
//   }
// );

export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;
      console.log("Refresh token:", refresh_token); // Log refresh token

      if (!refresh_token) {
        return next(new ErrorHandler("No refresh token provided", 400));
      }

      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as Secret
      ) as JwtPayload;
      console.log("Decoded JWT:", decoded); // Log decoded JWT

      const message = "Could not refresh token";
      if (!decoded || !decoded.id) {
        return next(new ErrorHandler(message, 400));
      }

      const session = await redis.get(decoded.id as string);
      console.log("Session from Redis:", session); // Log session

      if (!session) {
        return next(
          new ErrorHandler("Please Login to access this Resource!", 400)
        );
      }

      const user = JSON.parse(session);

      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as Secret,
        {
          expiresIn: "5m",
        }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as Secret,
        {
          expiresIn: "3d",
        }
      );

      req.user = user;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      await redis.set(user._id, JSON.stringify(user), "EX", 604800);

      next();
    } catch (error: any) {
      console.error("Error updating access token:", error); // Log error
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// but first solve the above error where accessToken and refreshToken aren't being updated and in postman it shows error that
// 400 Bad request the request cannot be fullfilled due to bad syntax.
// this error has being resolved by improving the syntax and the previous syntax is present in above comments.

// get user info

// export const getUserInfo = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
//   try {
//     const userId = req.user?._id;
//     getUserById( userId ,res);
//   } catch (error: any) {
//     return next(new ErrorHandler(error.message, 400));
//   }
// });

export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;

      // Check if userId is defined and is a string
      if (
        !userId ||
        !(
          typeof userId === "string" ||
          userId instanceof mongoose.Types.ObjectId
        )
      ) {
        return next(new ErrorHandler("User ID is not valid", 400));
      }

      // Call getUserById with userId
      await getUserById(userId.toString(), res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// social Auth
interface ISocialAuthBdy {
  email: string;
  name: string;
  avatar: string;
}

export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update user info
interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as IUpdateUserInfo;
      const userId = req.user?._id;

      if (
        !userId ||
        !(
          typeof userId === "string" ||
          userId instanceof mongoose.Types.ObjectId
        )
      ) {
        return next(new ErrorHandler("User ID is not valid", 400));
      }

      const user = await userModel.findById(userId);


      if (name && user) {
        user.name = name;
      }

      await user?.save();
      console.log("Saving user to Redis:", userId.toString());
      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// // update user password
// interface IUpdatePassword{
//   oldPassword: string;
//   newPassword: string;
// }

// export const updatePassword = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) =>{
//   try {
//     const {oldPassword,newPassword} = req.body as IUpdatePassword;

//     if(!oldPassword || !newPassword){
//       return next(new ErrorHandler("please enter old and new password",400))

//     }

//     const user = await userModel.findById(req.user?._id).select("+password");

//     if(user?.password === undefined){
//       return next(new ErrorHandler("Invalid User",400))
//     }

//     const isPasswordMatch = await user?.comparePassword(oldPassword);

//     if(!isPasswordMatch){
//       return next(new ErrorHandler("Invalid old password", 400));
//     }

//     user.password = newPassword;

//     await user.save();

//     await redis.set(req.user?._id.toString(), JSON.stringify(user));

//     res.status(201).json({
//       success: true,
//       user,
//     });

//   } catch (error: any) {
//     return next(new ErrorHandler(error.message, 400));
//   }
// })

// update user password
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;

      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("please enter old and new password", 400));
      }

      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("Invalid User ID", 400));
      }

      const user = await userModel.findById(userId).select("+password");

      if (!user || user.password === undefined) {
        return next(new ErrorHandler("Invalid User", 400));
      }

      const isPasswordMatch = await user.comparePassword(oldPassword);

      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid old password", 400));
      }

      user.password = newPassword;

      await user.save();

      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update user profile/ avatar
interface IUpdateProfilePicture {
  avatar: string;
}

export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body;

      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("Invalid User ID", 400));
      }

      const user = await userModel.findById(userId);

      if (avatar && user) {
        // if user already has an avatar then delete it first and then upload the new one
        if (user?.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user?.avatar?.public_id); // delete the old avatar
          // update the avatar
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } else {
          // update the avatar
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        }
      }

      await user?.save();

      await redis.set(userId?.toString(), JSON.stringify(user));

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get all users -- only for admin
export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersServices(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update user role -- only for admin
export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.body;
      await updateUserRoleServices(res, id, role);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// delete user -- only for admin
export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);

      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }

      await user.deleteOne({ id });

      await redis.del(id);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
