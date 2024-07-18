// interface ErrorConstructor {
//     captureStackTrace(thisArg: any, func: any): void
// }

// class ErrorHandler extends Error{
//     statusCode: Number
//     constructor(message:any,statusCode: Number){
//         super(message);
//         this.statusCode = statusCode;

//         Error.captureStackTrace(this,this.constructor);
//     }
// }

// module.exports = ErrorHandler

class ErrorHandler extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;

        // Use Error.captureStackTrace if it exists
        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, this.constructor);
        } else {
            // Fallback for environments without Error.captureStackTrace
            this.stack = (new Error(message)).stack;
        }
    }
}

export default ErrorHandler;


