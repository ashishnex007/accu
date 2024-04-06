const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;

// for handling file uploads
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.post("/upload", upload.single("image"), async (req, res) => {
  try {

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    
    const APIURL = "http://bhasha.iiit.ac.in/pageocr/api";
    const formData = new FormData();

    const imageBuffer = fs.readFileSync(req.file.path);
    formData.append("image", imageBuffer, path.basename(req.file.path));

    formData.append("language", req.body.language || "english");
    formData.append("version", req.body.version || "v4_robust");
    formData.append("modality", req.body.modality || "printed");
    formData.append("layout_model", req.body.layout_model || "v2_doctr");

    console.log("requesting....");
    
    //POST Request
    const response = await axios.post(APIURL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
    });
    
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    console.log("Error in backend " + error.message);
    res.status(500).json({ error: error.message });
  }  finally {
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.get("/", (req, res) => {
  res.send("Hi Mom");
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
