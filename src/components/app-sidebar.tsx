"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, MessageSquare } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  // SidebarFooter,
  // SidebarRail,
  // SidebarInput,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface ChatItem {
  id: string;
  title: string | null;
  roleName: string | null;
  updatedAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();
  const [chats, setChats] = useState<ChatItem[]>([]);

  // Fetch chat list on mount and when pathname changes (new chat created)
  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => setChats(data.conversations ?? []))
      .catch(() => {});
  }, [pathname]);

  const activeChatId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]
    : null;

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              className="w-full justify-start gap-2"
              variant="default"
              onClick={() => router.push("/")}
            >
              <Plus className="size-4" />
              New Search
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent Searches</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats
                .filter((c) => !c.title?.startsWith("test"))
                .map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      isActive={chat.id === activeChatId}
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      tooltip={chat.title || "Untitled"}
                    >
                      <MessageSquare className="size-4" />
                      <span className="flex-1 truncate">
                        {chat.title || "Untitled"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(chat.updatedAt)}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* SidebarFooter — add user/settings later */}
      {/* SidebarRail — add drag-to-resize later */}
    </Sidebar>
  );
}
