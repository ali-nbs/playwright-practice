import * as fs from "fs";
import * as path from "path"; 

const CHECKPOINT_FILE = path.join(process.cwd(), "checkpoint.json");

interface CheckpointData {
  lastCompleted: string;
  lastApp: string;
  savedAt: string;
}

export interface CheckpointState {
  lastCompleted: string;
  lastApp: string;
}

export const saveCheckpoint = (stepName: string, appName: string): void => {
  const data: CheckpointData = {
    lastCompleted: stepName,
    lastApp: appName,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
};

export const getCheckpoint = (): CheckpointState | null => {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;

  const data: CheckpointData = JSON.parse(
    fs.readFileSync(CHECKPOINT_FILE, "utf-8")
  );

  const isSameDay =
    new Date(data.savedAt).toDateString() === new Date().toDateString();

  if (!isSameDay) {
    clearCheckpoint();
    return null;
  }

  return { lastCompleted: data.lastCompleted, lastApp: data.lastApp };
};

export const clearCheckpoint = (): void => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
};