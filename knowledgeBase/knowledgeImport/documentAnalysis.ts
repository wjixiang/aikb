export default class DoucmentAnalysis {
  doc: string | null = null;

  import_doc_from_string(doc_content: string) {
    this.doc = doc_content;
    return this;
  }

  async analysis() {
    if (this.doc === null)
      throw new Error(`Doc property is empty, please import document first.`);
  }
}
