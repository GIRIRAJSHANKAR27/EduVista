// import React, { FC, useEffect, useState } from "react";
// import axios from "axios";

// type Props = {
//   videoUrl: string;
//   title: string;
// };

// const CoursePlayer: FC<Props> = ({ videoUrl }) => {
//   const [videoData, setVideoData] = useState({
//     otp: "",
//     playbackInfo: "",
//   });

//   useEffect(() => {
//     axios
//       .post(`${process.env.NEXT_PUBLIC_SERVER_URI}getVdoCipherOTP`, {
//         videoId: videoUrl,
//       })
//       .then((res) => {
//         setVideoData(res.data);
//       });
//   }, [videoUrl]);

//   return (
//     <div
//       style={{ position: "relative", paddingTop: "56.25%", overflow: "hidden" }}
//     >
//       {videoData.otp && videoData.playbackInfo !== "" && (
//         <iframe
//           src={`https://player.vdocipher.com/v2/?otp=${videoData?.otp}&playbackInfo=${videoData.playbackInfo}&player=R2VK2XhXm3BzlLCH`}
//           style= "border:0;height:360px;width:640px;max-width:100%"
//           allowFullScreen= "true"
//           allow="encrypted-media"
//         ></iframe>
//       )}
//     </div>
//   );
// };

// export default CoursePlayer;
import React, { FC, useEffect, useState } from "react";
import axios from "axios";

type Props = {
  videoUrl: string;
  title: string;
};

const CoursePlayer: FC<Props> = ({ videoUrl }) => {
  const [videoData, setVideoData] = useState({
    otp: "",
    playbackInfo: "",
  });

  useEffect(() => {
    axios
      .post(`${process.env.NEXT_PUBLIC_SERVER_URI}getVdoCipherOTP`, {
        videoId: videoUrl,
      })
      .then((res) => {
        setVideoData(res.data);
      });
  }, [videoUrl]);

  return (
    <div style={{ position: "relative", paddingTop: "56.25%", overflow: "hidden" }}>
      {videoData.otp && videoData.playbackInfo !== "" && (
        <iframe
          src={`https://player.vdocipher.com/v2/?otp=${videoData?.otp}&playbackInfo=${videoData.playbackInfo}&player=R2VK2XhXm3BzlLCH`}
          style={{ border: "0", height: "360px", width: "640px", maxWidth: "100%" }}
          allowFullScreen={true}
          allow="encrypted-media"
        ></iframe>
      )}
    </div>
  );
};

export default CoursePlayer;
