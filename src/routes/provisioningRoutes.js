const { Router } = require("express");
const {
  createProvisioningJob,
  startProvisioningJob,
  getProvisioningJobStatus
} = require("../controllers/provisioningController");

const router = Router();

router.post("/provision", createProvisioningJob);
router.post("/provision/start", startProvisioningJob);
router.get("/provision/:requestId/status", getProvisioningJobStatus);

module.exports = router;
