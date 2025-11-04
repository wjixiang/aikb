declare module 'segmentit' {
  class Segmentit {
    constructor();
    doSegment(
      text: string,
      options?: { simple?: boolean; stripPunctuation?: boolean },
    ): Array<{ w: string }>;
    static useDefault(segment: Segmentit): Segmentit;
  }

  export default Segmentit;
}
