export const ValidationMessages = ({
  id,
  messages,
}: {
  id?: string;
  messages: string[];
}) =>
  messages.length > 0 ? (
    <div id={id} className="term-card__mutation-error" role="alert">
      {messages.map((message, index) => (
        <p key={`${index}-${message}`}>{message}</p>
      ))}
    </div>
  ) : null;
