declare module "./archiverService.cjs" {
  function createZipArchive(filesToArchive: Array<{ type: string; content: Buffer | string; name: string }>): Promise<Buffer>;
  export { createZipArchive };
}
