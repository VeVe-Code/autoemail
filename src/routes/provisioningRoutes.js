const { Router } = require("express");
const {
  createProvisioningJob
} = require("../controllers/provisioningController");

const router = Router();

router.post("/provision", createProvisioningJob);

module.exports = router;
