import "../App.css";
import { Button, TextField, Snackbar } from "@mui/material";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import { Video } from "lucide-react"; // Added this line

function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const { addToUserHistory } = useContext(AuthContext);

  let handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setOpenSnackbar(true);
    setTimeout(() => {
      navigate("/"); // Redirect to landing page after 4 seconds
    }, 4000);
  };

  return (
    <>
      {/* Main Container with Background Image */}
      <div
        className="min-h-screen bg-black flex justify-center items-center p-6 relative"
        style={{
          backgroundImage: "url('/Untitled design.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Portal Logo in Top-left Corner */}
        <div className="flex items-center gap-2 absolute top-6 left-6 z-10">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Video className="h-6 w-6 text-white" />
          </div>
          <span className="font-semibold text-lg text-white font-[Poppins]">PORTAL</span>
        </div>

        {/* Logout Button in Top-right Corner */}
        <div className="absolute top-6 right-6 z-10">
          <Button
            onClick={handleLogout}
            sx={{
              backgroundColor: "transparent",
              color: "white",
              border: "2px solid black",
              "&:hover": {
                borderColor: "white",
                color: "#D3D3D3",
                backgroundColor: "transparent",
              },
              padding: "8px 20px",
              borderRadius: "8px",
            }}
          >
            LOGOUT
          </Button>
        </div>

        {/* Content Container */}
        <div className="w-full max-w-4xl flex flex-col justify-center items-center space-y-6 relative z-10">
          {/* Meeting Code Section */}
          <div
            className="flex flex-col items-center justify-center bg-zinc-900 p-8 rounded-2xl shadow-[0px_4px_40px_2px_rgba(169,169,169,0.3)] max-w-lg mx-auto"
            style={{
              width: "80%",
              height: "auto",
              maxWidth: "700px",
              minHeight: "300px",
            }}
          >
            <h2 className="text-2xl font-bold text-center text-white mb-6">
              Navigate your meetings like magic — only on Portal.
            </h2>
            <div className="flex flex-col sm:flex-row gap-6 w-full">
              <TextField
                onChange={(e) => setMeetingCode(e.target.value)}
                label="MEETING CODE"
                variant="outlined"
                fullWidth
                className="bg-zinc-800 text-white"
                InputLabelProps={{
                  style: { color: "white" },
                }}
                InputProps={{
                  style: { color: "white" },
                }}
                sx={{
                  borderRadius: "20px",
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "20px",
                  },
                }}
              />
              <Button
                onClick={handleJoinVideoCall}
                variant="contained"
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
              >
                Join
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Snackbar for Logout Confirmation */}
      <Snackbar
        open={openSnackbar}
        message="You have been logged out"
        autoHideDuration={4000}
        onClose={() => setOpenSnackbar(false)}
      />
    </>
  );
}

export default HomeComponent;
