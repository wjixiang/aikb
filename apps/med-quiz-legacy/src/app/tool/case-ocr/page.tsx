"use client";
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

export default function CaseOCRPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [result, setResult] = useState<{
    originalText?: string;
    cleanedText?: string;
    structuredData?: any;
    formattedDocument?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages([...images, ...newImages]);
    setResult(null);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(images);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setImages(items);
  };

  const removeImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  const handleSubmit = async () => {
    if (images.length === 0) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      images.forEach((img) => {
        formData.append("images", img.file);
      });

      const response = await fetch("/api/tool/case-ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("OCR processing failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to process image");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>医学图片转病历</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image">上传医学图片（可多选）</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              multiple
            />
          </div>

          {images.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">
                图片预览（可拖拽排序）
              </h3>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="images" direction="horizontal">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="flex gap-2 overflow-x-auto py-2"
                    >
                      {images.map((img, index) => (
                        <Draggable
                          key={img.id}
                          draggableId={img.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="relative"
                            >
                              <img
                                src={img.preview}
                                alt="Preview"
                                className="w-32 h-32 object-cover rounded-md cursor-pointer"
                                onClick={() => setSelectedImage(img.preview)}
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(img.id)}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={images.length === 0 || isLoading}
          >
            {isLoading ? "处理中..." : "转换为病历文本"}
          </Button>

          {result && (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">原始识别结果</h3>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                  {result.originalText}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">清理后文本</h3>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                  {result.cleanedText}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">结构化数据</h3>
                <pre className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                  {JSON.stringify(result.structuredData, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">格式化病历文档</h3>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                  {result.formattedDocument}
                </div>
              </div>
            </div>
          )}

          <Dialog
            open={!!selectedImage}
            onOpenChange={(open) => !open && setSelectedImage(null)}
          >
            <DialogContent className="max-w-[90vw] max-h-[90vh]">
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Enlarged preview"
                  className="w-full h-full object-contain"
                />
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
