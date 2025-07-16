import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@weldr/ui/components/avatar";
import { Button } from "@weldr/ui/components/button";
import { Calendar } from "@weldr/ui/components/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@weldr/ui/components/dropdown-menu";
import { Label } from "@weldr/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weldr/ui/components/popover";
import { Separator } from "@weldr/ui/components/separator";
import { Switch } from "@weldr/ui/components/switch";
import { Textarea } from "@weldr/ui/components/textarea";
import { addDays, addHours, format, nextSaturday } from "date-fns";
import {
  Archive,
  ArchiveX,
  Clock,
  Forward,
  MoreVertical,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react";
import type { Mail } from "../data";

interface MailDisplayProps {
  mail: Mail | null;
}

export function MailDisplay({ mail }: MailDisplayProps) {
  const today = new Date();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center p-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!mail} title="Archive">
            <Archive className="h-4 w-4" />
            <span className="sr-only">Archive</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!mail}
            title="Move to junk"
          >
            <ArchiveX className="h-4 w-4" />
            <span className="sr-only">Move to junk</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!mail}
            title="Move to trash"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Move to trash</span>
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!mail}
                title="Snooze"
              >
                <Clock className="h-4 w-4" />
                <span className="sr-only">Snooze</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="flex w-[535px] p-0">
              <div className="flex flex-col gap-2 border-r px-2 py-4">
                <div className="px-4 font-medium text-sm">Snooze until</div>
                <div className="grid min-w-[250px] gap-1">
                  <Button variant="ghost" className="justify-start font-normal">
                    Later today{" "}
                    <span className="ml-auto text-muted-foreground">
                      {format(addHours(today, 4), "E, h:m b")}
                    </span>
                  </Button>
                  <Button variant="ghost" className="justify-start font-normal">
                    Tomorrow
                    <span className="ml-auto text-muted-foreground">
                      {format(addDays(today, 1), "E, h:m b")}
                    </span>
                  </Button>
                  <Button variant="ghost" className="justify-start font-normal">
                    This weekend
                    <span className="ml-auto text-muted-foreground">
                      {format(nextSaturday(today), "E, h:m b")}
                    </span>
                  </Button>
                  <Button variant="ghost" className="justify-start font-normal">
                    Next week
                    <span className="ml-auto text-muted-foreground">
                      {format(addDays(today, 7), "E, h:m b")}
                    </span>
                  </Button>
                </div>
              </div>
              <div className="p-2">
                <Calendar />
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!mail} title="Reply">
            <Reply className="h-4 w-4" />
            <span className="sr-only">Reply</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!mail}
            title="Reply all"
          >
            <ReplyAll className="h-4 w-4" />
            <span className="sr-only">Reply all</span>
          </Button>
          <Button variant="ghost" size="icon" disabled={!mail} title="Forward">
            <Forward className="h-4 w-4" />
            <span className="sr-only">Forward</span>
          </Button>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!mail}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem>Star thread</DropdownMenuItem>
            <DropdownMenuItem>Add label</DropdownMenuItem>
            <DropdownMenuItem>Mute thread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator />
      {mail ? (
        <div className="flex flex-1 flex-col">
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm">
              <Avatar>
                <AvatarImage alt={mail.name} />
                <AvatarFallback>
                  {mail.name
                    .split(" ")
                    .map((chunk: string) => chunk[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <div className="font-semibold">{mail.name}</div>
                <div className="line-clamp-1 text-xs">{mail.subject}</div>
                <div className="line-clamp-1 text-xs">
                  <span className="font-medium">Reply-To:</span> {mail.email}
                </div>
              </div>
            </div>
            {mail.date && (
              <div className="ml-auto text-muted-foreground text-xs">
                {format(new Date(mail.date), "PPpp")}
              </div>
            )}
          </div>
          <Separator />
          <div className="flex-1 whitespace-pre-wrap p-4 text-sm">
            {mail.text}
          </div>
          <Separator className="mt-auto" />
          <div className="p-4">
            <form>
              <div className="grid gap-4">
                <Textarea
                  className="p-4"
                  placeholder={`Reply ${mail.name}...`}
                />
                <div className="flex items-center">
                  <Label
                    htmlFor="mute"
                    className="flex items-center gap-2 font-normal text-xs"
                  >
                    <Switch id="mute" aria-label="Mute thread" /> Mute this
                    thread
                  </Label>
                  <Button
                    onClick={(e) => e.preventDefault()}
                    size="sm"
                    className="ml-auto"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">
          No message selected
        </div>
      )}
    </div>
  );
}
