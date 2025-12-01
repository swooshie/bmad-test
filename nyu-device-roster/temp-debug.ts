import { MongoMemoryServer } from "mongodb-memory-server";
import connectToDatabase, { resetDatabaseConnectionForTests } from "@/lib/db";
import { runDeviceSync } from "@/workers/sync";

const rows = [
  { serial: "demo-001", deviceId: "demo-001", assignedTo: "Alex", status: "Active", condition: "Good" },
  { serial: "demo-002", deviceId: "demo-002", assignedTo: "Jordan", status: "Active", condition: "Needs Repair" },
];

(async () => {
  const mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
  const uri = mongo.getUri();
  await connectToDatabase(uri);
  try {
    const result = await runDeviceSync({ sheetId: "debug-sheet", overrideRows: rows, runId: "debug", requestId: "req" });
    console.log("result", result);
  } catch (error) {
    console.error("runDeviceSync error", error);
  } finally {
    await mongo.stop();
    resetDatabaseConnectionForTests();
  }
})();
