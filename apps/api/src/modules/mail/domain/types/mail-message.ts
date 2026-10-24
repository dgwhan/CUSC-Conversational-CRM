// Cho phép nội dung mail dạng text, HTML hoặc đồng thời cả hai.
type MailContent =
    | {
        text: string;
        html?: never
    } | {
        text?: never;
        html: string;
    } | {
        text: string;
        html: string;
    };

export type MailMessage = {
    from: string;
    to: string;
    subject: string;
} & MailContent;
