import './App.css';
import Home from './pages/Home/Home';
// import VideoCallRoom from './pages/VideoCallRoom/VideoCallRoom';
import VideoRoom from './pages/VideoCallRoom/VideoRoom';
// import TestRoom from './pages/WaitingRoom/TestRoom';
import WaitingRoom from './pages/WaitingRoom/WaitingRoom';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";


function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rooms" element={<VideoRoom />} />
          {/* <Route path="/waiting-room" element={<TestRoom />} /> */}
          {/* <Route path="/room" element={<VideoCallRoom />} /> */}
        </Routes>
      </Router>
    </div>
  );
}

export default App;
