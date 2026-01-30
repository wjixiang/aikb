'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { TranslationPractice } from '@/components/ai-coach/TranslationPractice';
import { Loader2, Save, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface TranslationDocument {
  id: string;
  userId: string;
  title: string;
  text: string;
  sentences: string[];
  isPublic: boolean;
  createdAt: string;
  sentenceCount: number;
  isOwner: boolean;
}

interface FavoriteSentence {
  id: string;
  documentId: string;
  sentenceIndex: number;
  sentence: string;
  documentTitle: string;
  documentContent: string;
  createdAt: string;
}

export default function TranslationPracticePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [article, setArticle] = useState('');
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDocuments, setSavedDocuments] = useState<TranslationDocument[]>(
    [],
  );
  const [selectedDocument, setSelectedDocument] =
    useState<TranslationDocument | null>(null);
  const [favoriteSentences, setFavoriteSentences] = useState<
    FavoriteSentence[]
  >([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  // Fetch documents and favorites on component mount
  useEffect(() => {
    if (session) {
      fetchDocuments();
      fetchFavoriteSentences();
    }
  }, [session]);

  // Fetch documents - only private documents now
  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        '/api/translation-practice/upload?scope=private',
      );
      const data = await response.json();
      if (data.success) {
        setSavedDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Fetch favorite sentences
  const fetchFavoriteSentences = async () => {
    try {
      const response = await fetch('/api/translation-practice/favorites/all');
      const data = await response.json();
      if (data.success) {
        setFavoriteSentences(data.favorites);
      }
    } catch (error) {
      console.error('Error fetching favorite sentences:', error);
    }
  };

  const handleSubmit = () => {
    setIsGenerating(true);
    try {
      const splitSentences = article.split(
        /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=[.!?])\s+/,
      );
      setSentences(splitSentences.filter((s) => s.trim().length > 0));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!article.trim()) return;

    setIsSaving(true);
    try {
      const splitSentences = article.split(
        /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=[.!?])\s+/,
      );
      const sentences = splitSentences.filter((s) => s.trim().length > 0);

      const response = await fetch('/api/translation-practice/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: article,
          title: title || 'Untitled Translation Practice',
          isPublic: false, // Always private
          sentences: sentences,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Translation practice saved successfully!');
        setSentences(sentences);
        // Create a new document object for the selected document
        const newDoc: TranslationDocument = {
          id: data.documentId,
          userId: session?.user?.id || '',
          title: title || 'Untitled Translation Practice',
          text: article,
          sentences: sentences,
          isPublic: false,
          createdAt: new Date().toISOString(),
          sentenceCount: sentences.length,
          isOwner: true,
        };
        setSelectedDocument(newDoc);
        // Refresh documents list
        fetchDocuments();
      } else {
        alert('Error saving translation practice: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving translation practice');
    } finally {
      setIsSaving(false);
    }
  };

  const loadDocument = (doc: TranslationDocument) => {
    setArticle(doc.text);
    setTitle(doc.title);
    setSentences(doc.sentences);
    setSelectedDocument(doc);
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  interface FavoriteSentencesCarouselProps {
    favorites: FavoriteSentence[];
    onLoadSentence: (sentence: string, documentContent: string) => void;
  }

  function FavoriteSentencesCarousel({
    favorites,
    onLoadSentence,
  }: FavoriteSentencesCarouselProps) {
    if (favorites.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">暂无收藏句子</p>
      );
    }

    return (
      <Carousel className="w-full">
        <CarouselContent>
          {favorites.map((fav: FavoriteSentence) => (
            <CarouselItem key={fav.id} className="md:basis-1/2 lg:basis-1/3">
              <div className="p-1">
                <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-all duration-200 hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div
                      className="flex-1"
                      onClick={() =>
                        onLoadSentence(fav.sentence, fav.documentContent)
                      }
                    >
                      <h3 className="font-semibold text-lg mb-2">
                        {fav.documentTitle}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {new Date(fav.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                      <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                        {fav.sentence}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">翻译练习</h1>
          <p className="text-muted-foreground">
            输入英文文章，系统会自动分割成句子供你翻译练习
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">输入文章</h2>
            <div className="space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文章标题（可选）"
                className="text-base"
              />
              <Textarea
                value={article}
                onChange={(e) => setArticle(e.target.value)}
                placeholder="请输入英文文章（建议200-500词）..."
                className="min-h-[200px] text-base"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={!article.trim() || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存练习
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">我的文档</h2>
            <p className="text-muted-foreground mb-4">
              浏览和管理您的翻译练习文档
            </p>
            <DocumentCarousel
              documents={savedDocuments.filter((doc) => doc.isOwner)}
              onLoad={loadDocument}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">收藏句子</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFavorites(!showFavorites)}
              >
                <Heart className="mr-2 h-4 w-4" />
                {showFavorites ? '隐藏收藏' : '显示收藏'} (
                {favoriteSentences.length})
              </Button>
            </div>
            {showFavorites && (
              <FavoriteSentencesCarousel
                favorites={favoriteSentences}
                onLoadSentence={(sentence, documentContent) => {
                  setArticle(documentContent);
                  setTitle('收藏句子练习');
                  setSentences([sentence]);
                  setSelectedDocument(null);
                }}
              />
            )}
          </div>
        </div>

        {sentences.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                翻译练习 ({sentences.length}句)
              </h2>
              {selectedDocument && (
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">
                    正在学习: {selectedDocument.title}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {sentences.map((sentence, index) => (
                <TranslationPractice
                  key={index}
                  englishText={sentence}
                  getFullText={() => article}
                  documentId={selectedDocument?.id}
                  sentenceIndex={index}
                  onFavoriteChange={fetchFavoriteSentences}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentCarouselProps {
  documents: TranslationDocument[];
  onLoad: (doc: TranslationDocument) => void;
}

function DocumentCarousel({ documents, onLoad }: DocumentCarouselProps) {
  if (documents.length === 0) {
    return <p className="text-muted-foreground text-center py-8">暂无文档</p>;
  }

  return (
    <Carousel className="w-full">
      <CarouselContent>
        {documents.map((doc: TranslationDocument) => (
          <CarouselItem key={doc.id} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-1">
              <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-all duration-200 hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div className="flex-1" onClick={() => onLoad(doc)}>
                    <h3 className="font-semibold text-lg mb-2">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {new Date(doc.createdAt).toLocaleDateString('zh-CN')} ·{' '}
                      {doc.sentenceCount} 句
                    </p>
                    <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                      {doc.text.substring(0, 150)}...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
