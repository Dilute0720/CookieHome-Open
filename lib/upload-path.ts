import path from "path";

export function getLocalUploadDir() {
  return process.env.LOCAL_UPLOAD_DIR
    ? path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_UPLOAD_DIR)
    : path.join(process.cwd(), "public", "uploads");
}
