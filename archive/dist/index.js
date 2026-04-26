"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pipeline_1 = require("./pipeline");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = process.env.PORT || 3001;
app.get('/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });
app.post('/run/source', async (req, res) => { res.json({ status: 'started' }); (0, pipeline_1.runSourcingPipeline)().catch(console.error); });
app.post('/run/outreach', async (req, res) => { res.json({ status: 'started' }); (0, pipeline_1.runOutreachPipeline)().catch(console.error); });
app.post('/run/full', async (req, res) => { res.json({ status: 'started' }); (async () => { await (0, pipeline_1.runSourcingPipeline)(); await (0, pipeline_1.runOutreachPipeline)(); })().catch(console.error); });
app.post('/webhooks/retell', async (req, res) => { const { event, call } = req.body; res.json({ received: true }); if (event === 'call_ended' && call?.metadata?.candidate_email)
    (0, pipeline_1.handleScreeningCallComplete)(call.metadata.candidate_email, call.metadata.nia_candidate_id, call.transcript || '').catch(console.error); });
app.post('/api/warm-intro', async (req, res) => { const { candidateEmail, niaCandidateId } = req.body; res.json({ status: 'started' }); (0, pipeline_1.sendWarmIntro)(candidateEmail, niaCandidateId).catch(console.error); });
app.listen(PORT, () => { console.log(`OpenRecruiter running on port ${PORT}`); (0, pipeline_1.startReplyHandler)(); });
exports.default = app;
