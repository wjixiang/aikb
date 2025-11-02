"use client";
"src/app/fsrs/manage/page.tsx";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { AnkiCollectionPreset, UserSubscription } from "@/types/anki.types";

export default function FsrsPage() {
  const { data: session } = useSession();
  const [userSubscriptions, setUserSubscriptions] = useState<
    UserSubscription[]
  >([]);
  const [presetCollections, setPresetCollections] = useState<
    AnkiCollectionPreset[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] =
    useState<AnkiCollectionPreset | null>(null);

  useEffect(() => {
    if (session) {
      fetchSubscriptions();
      fetchPresetCollections();
    }
  }, [session]);

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch("/api/fsrs/collections/subscriptions");
      if (response.ok) {
        const data = await response.json();
        console.log(data);
        console.log(data);
        setUserSubscriptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch subscriptions:", error);
      toast.error("获取订阅牌组失败", {
        description: "无法获取已经订阅设牌组信息，请稍后再试",
      });
    }
  };

  const fetchPresetCollections = async () => {
    try {
      const response = await fetch("/api/fsrs/collections/presets");
      if (response.ok) {
        const data = await response.json();
        setPresetCollections(data);
      }
    } catch (error) {
      console.error("Failed to fetch preset collections:", error);

      toast.error("获取预设牌组失败", {
        description: "无法获取预设牌组信息，请稍后再试",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新学习状态
  const refreshLearningStatus = useCallback(async (collectionId: string) => {
    try {
      const response = await fetch("/api/fsrs/collections/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "刷新学习状态失败");
      }

      // 刷新订阅列表
      await fetchSubscriptions();

      return true;
    } catch (error) {
      console.error("Failed to refresh learning status:", error);
      toast.error("刷新学习状态失败", {
        description: "刷新牌组学习状态时发生错误。",
      });

      return false;
    }
  }, []);

  const handleSubscribe = async (collectionId: string) => {
    try {
      const response = await fetch("/api/fsrs/collections/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionId,
        }),
      });

      if (response.ok) {
        // 订阅成功后，刷新学习状态
        const refreshResult = await refreshLearningStatus(collectionId);

        toast.success("订阅成功", {
          style: {
            backgroundColor: "#4caf50",
            color: "white",
          },
          description: refreshResult
            ? "成功订阅牌组并初始化学习计划，现在可以开始复习了！"
            : "成功订阅牌组，但初始化学习计划失败，请稍后手动刷新。",
          duration: 2000,
        });

        // 刷新订阅列表
        fetchSubscriptions();
      } else {
        const error = await response.json();
        throw new Error(error.error || "订阅失败");
      }
    } catch (error) {
      console.error("Failed to subscribe:", error);
      toast.error("订阅失败", {
        description: "订阅牌组时发生错误。",
      });
    }
  };

  const handleUnsubscribe = async (subscriptionId: string) => {
    if (!confirm("确定要取消订阅此牌组吗？所有复习记录将被删除。")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/fsrs/collections/subscriptions/${subscriptionId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("取消订阅成功", {
          style: {
            backgroundColor: "#4caf50",
            color: "white",
          },
          description: "已取消订阅牌组",
          duration: 1000,
        });
        // 刷新订阅列表
        fetchSubscriptions();
      } else {
        const error = await response.json();
        throw new Error(error.error || "取消订阅失败");
      }
    } catch (error) {
      console.error("Failed to unsubscribe:", error);

      toast.error("取消订阅失败", {
        description: "取消订阅牌组时发生错误。",
        style: {
          backgroundColor: "#af4c4c",
          color: "white",
        },
      });
    }
  };

  const handleSaveFsrsParams = async (subscriptionId: string, params: any) => {
    try {
      const response = await fetch(
        `/api/fsrs/collections/subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fsrsParams: params,
          }),
        },
      );

      if (response.ok) {
        toast.success("设置已保存", {
          style: {
            backgroundColor: "#4caf50",
            color: "white",
          },
          description: "FSRS参数已成功更新。",
          duration: 1000,
        });
        // 刷新订阅列表
        fetchSubscriptions();
      } else {
        const error = await response.json();
        throw new Error(error.error || "保存设置失败");
      }
    } catch (error) {
      console.error("Failed to save FSRS params:", error);
      toast.error("保存设置失败", {
        description: "保存FSRS参数时发生错误。",
        style: {
          backgroundColor: "#af4c4c",
          color: "white",
        },
      });
    }
  };

  const viewCollectionDetails = async (collectionId: string) => {
    setSelectedCollection(null);
    try {
      const response = await fetch(
        `/api/fsrs/collections/presets/${collectionId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedCollection(data);
      } else {
        const error = await response.json();
        throw new Error(error.error || "获取牌组详情失败");
      }
    } catch (error) {
      console.error("Failed to fetch collection details:", error);
      toast.error("获取牌组详情失败", {
        description: "无法获取所选牌组的详细信息。",
      });
    }
  };

  const FsrsParametersDialog = ({
    subscription,
  }: {
    subscription: UserSubscription;
  }) => {
    const defaultParams = {
      requestRetention: 0.9,
      maximumInterval: 36500,
      weights: [
        0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18,
      ],
      newCardsPerDay: 20,
      maxReviewsPerDay: 200,
      learningSteps: [1, 10],
      lapseSteps: [10],
    };

    const [params, setParams] = useState({
      ...defaultParams,
      ...subscription.fsrsParams,
      ...subscription.scheduleParams,
    });
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = () => {
      handleSaveFsrsParams(subscription.userId, params);
      setIsOpen(false);
    };

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            设置参数
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>FSRS 参数设置</DialogTitle>
            <DialogDescription>
              调整此牌组的FSRS算法参数。除非你清楚这些参数的意义，否则建议保持默认设置。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <h3 className="font-bold">FSRS算法参数</h3>
              <div className="space-y-2">
                <h4 className="font-medium">记忆留存率目标</h4>
                <div className="flex items-center justify-between">
                  <Slider
                    value={[params.requestRetention * 100]}
                    min={50}
                    max={100}
                    step={1}
                    onValueChange={(value) =>
                      setParams({ ...params, requestRetention: value[0] / 100 })
                    }
                    className="w-[60%]"
                  />
                  <span>{(params.requestRetention * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">最大间隔天数</h4>
                <div className="flex items-center justify-between">
                  <Slider
                    value={[params.maximumInterval]}
                    min={365}
                    max={36500}
                    step={365}
                    onValueChange={(value) =>
                      setParams({ ...params, maximumInterval: value[0] })
                    }
                    className="w-[60%]"
                  />
                  <span>{(params.maximumInterval / 365).toFixed(0)}年</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold">学习计划设置</h3>
              <div className="space-y-2">
                <h4 className="font-medium">每日新卡片上限</h4>
                <div className="flex items-center justify-between">
                  <Slider
                    value={[params.newCardsPerDay]}
                    min={1}
                    max={100}
                    step={1}
                    onValueChange={(value) =>
                      setParams({ ...params, newCardsPerDay: value[0] })
                    }
                    className="w-[60%]"
                  />
                  <span>{params.newCardsPerDay}张</span>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">每日复习上限</h4>
                <div className="flex items-center justify-between">
                  <Slider
                    value={[params.maxReviewsPerDay]}
                    min={10}
                    max={500}
                    step={10}
                    onValueChange={(value) =>
                      setParams({ ...params, maxReviewsPerDay: value[0] })
                    }
                    className="w-[60%]"
                  />
                  <span>{params.maxReviewsPerDay}张</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold">学习阶段设置</h3>
              <div className="space-y-2">
                <h4 className="font-medium">学习阶段间隔(分钟)</h4>
                <div className="flex items-center gap-2">
                  {params.learningSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={step}
                        min={1}
                        max={1440}
                        onChange={(e) => {
                          const newSteps = [...params.learningSteps];
                          newSteps[index] = Number(e.target.value);
                          setParams({ ...params, learningSteps: newSteps });
                        }}
                        className="w-20"
                      />
                      {index < params.learningSteps.length - 1 && (
                        <span>,</span>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setParams({
                        ...params,
                        learningSteps: [...params.learningSteps, 10],
                      })
                    }
                  >
                    添加
                  </Button>
                  {params.learningSteps.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setParams({
                          ...params,
                          learningSteps: params.learningSteps.slice(0, -1),
                        })
                      }
                    >
                      移除
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">遗忘后重学间隔(分钟)</h4>
                <div className="flex items-center gap-2">
                  {params.lapseSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={step}
                        min={1}
                        max={1440}
                        onChange={(e) => {
                          const newSteps = [...params.lapseSteps];
                          newSteps[index] = Number(e.target.value);
                          setParams({ ...params, lapseSteps: newSteps });
                        }}
                        className="w-20"
                      />
                      {index < params.lapseSteps.length - 1 && <span>,</span>}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setParams({
                        ...params,
                        lapseSteps: [...params.lapseSteps, 10],
                      })
                    }
                  >
                    添加
                  </Button>
                  {params.lapseSteps.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setParams({
                          ...params,
                          lapseSteps: params.lapseSteps.slice(0, -1),
                        })
                      }
                    >
                      移除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setParams(defaultParams);
                toast.info("已重置为默认参数");
              }}
            >
              重置默认
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave}>保存设置</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">正在加载...</div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        请登录以使用FSRS功能
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">FSRS 记忆系统</h1>

      <Tabs defaultValue="subscriptions">
        <TabsList className="mb-4">
          <TabsTrigger value="subscriptions">我的订阅</TabsTrigger>
          <TabsTrigger value="preset">预设牌组</TabsTrigger>
        </TabsList>
        <p></p>
        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>我订阅的牌组</CardTitle>
              <CardDescription>管理你已订阅的记忆牌组</CardDescription>
            </CardHeader>
            <CardContent>
              {userSubscriptions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>牌组名称</TableHead>
                      <TableHead>内容简介</TableHead>
                      <TableHead>新卡片</TableHead>
                      <TableHead>待复习</TableHead>
                      <TableHead>今日已复习</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userSubscriptions.map((subscription) => (
                      <TableRow key={subscription.collectionId}>
                        <TableCell className="font-medium">
                          {subscription.collectionName}
                        </TableCell>
                        <TableCell>
                          {subscription.collectionDescription}
                        </TableCell>
                        <TableCell>{subscription.newCardsCount || 0}</TableCell>
                        <TableCell>{subscription.dueCount || 0}</TableCell>
                        <TableCell>{subscription.reviewedToday || 0}</TableCell>
                        <TableCell className="space-x-2">
                          {/* <Button variant="outline" size="sm" asChild>
                            <a href={`/review/${subscription.collectionId}`}>开始复习</a>
                          </Button> */}
                          <FsrsParametersDialog subscription={subscription} />
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (!subscription._id) return;
                              handleUnsubscribe(subscription._id.toString());
                            }}
                          >
                            取消订阅
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground mb-4">
                    你还没有订阅任何牌组
                  </p>
                  <p>在&quot;预设牌组&quot;标签页中选择感兴趣的牌组进行订阅</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preset">
          <Card>
            <CardHeader>
              a<CardTitle>可订阅的牌组</CardTitle>
              <CardDescription>浏览和订阅预设的记忆牌组</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="搜索牌组..."
                  className="max-w-sm"
                  // 这里可以添加搜索功能
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>牌组名称</TableHead>
                    <TableHead>内容简介</TableHead>
                    <TableHead>卡片数量</TableHead>
                    <TableHead>创建者</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presetCollections.map((collection) => (
                    <TableRow key={collection._id.toString()}>
                      <TableCell className="font-medium">
                        {collection.collectionName}
                      </TableCell>
                      <TableCell>{collection.description}</TableCell>
                      <TableCell>{collection.cards.length || "未知"}</TableCell>
                      <TableCell>{collection.creator || "系统"}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            viewCollectionDetails(collection._id.toString())
                          }
                        >
                          查看详情
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleSubscribe(collection._id.toString())
                          }
                        >
                          订阅
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedCollection && (
        <Dialog
          open={!!selectedCollection}
          onOpenChange={(open) => !open && setSelectedCollection(null)}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{selectedCollection.collectionName}</DialogTitle>
              <DialogDescription>
                {selectedCollection.description}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <h4 className="font-medium mb-2">牌组内容预览</h4>
              <div className="border rounded p-4 max-h-[300px] overflow-y-auto">
                {selectedCollection.cards?.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedCollection.cards
                      .slice(0, 10)
                      .map((card, index) => (
                        <li key={index} className="border-b pb-2 last:border-0">
                          <p className="font-medium">{card.title}</p>
                          {/* <p className="text-sm text-muted-foreground">{card.back}</p> */}
                        </li>
                      ))}
                    {selectedCollection.cards.length > 10 && (
                      <li className="text-center text-muted-foreground">
                        显示前10张卡片（共{selectedCollection.cards.length}张）
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">无可预览的内容</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedCollection(null)}
              >
                关闭
              </Button>
              <Button
                onClick={() =>
                  handleSubscribe(selectedCollection._id.toString())
                }
              >
                订阅此牌组
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
