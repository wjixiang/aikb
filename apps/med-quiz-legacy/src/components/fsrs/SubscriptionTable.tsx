import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../ui/table";
import { UserSubscription } from "@/types/anki.types";
import { toast } from "sonner";

interface SubscriptionTableProps {
  onSelectCollection: (collectionId: string) => void;
  key?: number;
  isExpanded: boolean;
}

export default function SubscriptionTable({
  onSelectCollection,
  key,
  isExpanded,
}: SubscriptionTableProps) {
  const [userSubscriptions, setUserSubscriptions] = useState<
    UserSubscription[]
  >([]);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await fetch("/api/fsrs/collections/subscriptions");
        if (response.ok) {
          const data = await response.json();
          setUserSubscriptions(data);
        }
      } catch (error) {
        console.error("Failed to fetch subscriptions:", error);
        toast.error("获取订阅牌组失败", {
          description: "无法获取已经订阅设牌组信息，请稍后再试",
        });
      }
    };

    fetchSubscriptions();
  }, [key]);

  return (
    <div
      className={`transition-all duration-300 ease-in-out overflow-hidden 
      ${isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
    >
      <Card>
        <CardHeader>
          <CardTitle>我订阅的牌组</CardTitle>
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
                    <TableCell>{subscription.collectionDescription}</TableCell>
                    <TableCell>{subscription.newCardsCount || 0}</TableCell>
                    <TableCell>{subscription.reviewCardsCount || 0}</TableCell>
                    <TableCell>
                      {subscription.reviewedToday +
                        subscription.newCardsToday || 0}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="default"
                        onClick={() =>
                          onSelectCollection(subscription.collectionId)
                        }
                      >
                        开始学习
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">你还没有订阅任何牌组</p>
              <p>在&quot;预设牌组&quot;标签页中选择感兴趣的牌组进行订阅</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
