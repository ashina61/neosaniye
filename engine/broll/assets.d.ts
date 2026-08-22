/** Font files are imported for their emitted URL, not their contents. */
declare module '*.woff2' {
  const url: string;
  export default url;
}
