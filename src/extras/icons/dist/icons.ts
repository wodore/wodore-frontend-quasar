export type IconsId =
  | "text-outline"
  | "subject"
  | "server"
  | "question-mark"
  | "more-vertical"
  | "message"
  | "menu"
  | "menu-arrow"
  | "location-question"
  | "link"
  | "info"
  | "info-outline"
  | "gift"
  | "filter"
  | "filter-outline"
  | "favorite"
  | "favorite-outline"
  | "eye"
  | "eye-outline"
  | "edit"
  | "edit-outline"
  | "close"
  | "checkmark"
  | "calendar"
  | "browser"
  | "bell"
  | "bell-outline"
  | "at"
  | "arrowhead-up"
  | "arrowhead-right"
  | "arrowhead-left"
  | "arrowhead-down"
  | "arrow-up-down"
  | "alert-triangle-outline"
  | "add"
  | "add-outline";

export type IconsKey =
  | "TextOutline"
  | "Subject"
  | "Server"
  | "QuestionMark"
  | "MoreVertical"
  | "Message"
  | "Menu"
  | "MenuArrow"
  | "LocationQuestion"
  | "Link"
  | "Info"
  | "InfoOutline"
  | "Gift"
  | "Filter"
  | "FilterOutline"
  | "Favorite"
  | "FavoriteOutline"
  | "Eye"
  | "EyeOutline"
  | "Edit"
  | "EditOutline"
  | "Close"
  | "Checkmark"
  | "Calendar"
  | "Browser"
  | "Bell"
  | "BellOutline"
  | "At"
  | "ArrowheadUp"
  | "ArrowheadRight"
  | "ArrowheadLeft"
  | "ArrowheadDown"
  | "ArrowUpDown"
  | "AlertTriangleOutline"
  | "Add"
  | "AddOutline";

export enum Icons {
  TextOutline = "text-outline",
  Subject = "subject",
  Server = "server",
  QuestionMark = "question-mark",
  MoreVertical = "more-vertical",
  Message = "message",
  Menu = "menu",
  MenuArrow = "menu-arrow",
  LocationQuestion = "location-question",
  Link = "link",
  Info = "info",
  InfoOutline = "info-outline",
  Gift = "gift",
  Filter = "filter",
  FilterOutline = "filter-outline",
  Favorite = "favorite",
  FavoriteOutline = "favorite-outline",
  Eye = "eye",
  EyeOutline = "eye-outline",
  Edit = "edit",
  EditOutline = "edit-outline",
  Close = "close",
  Checkmark = "checkmark",
  Calendar = "calendar",
  Browser = "browser",
  Bell = "bell",
  BellOutline = "bell-outline",
  At = "at",
  ArrowheadUp = "arrowhead-up",
  ArrowheadRight = "arrowhead-right",
  ArrowheadLeft = "arrowhead-left",
  ArrowheadDown = "arrowhead-down",
  ArrowUpDown = "arrow-up-down",
  AlertTriangleOutline = "alert-triangle-outline",
  Add = "add",
  AddOutline = "add-outline",
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.TextOutline]: "61697",
  [Icons.Subject]: "61698",
  [Icons.Server]: "61699",
  [Icons.QuestionMark]: "61700",
  [Icons.MoreVertical]: "61701",
  [Icons.Message]: "61702",
  [Icons.Menu]: "61703",
  [Icons.MenuArrow]: "61704",
  [Icons.LocationQuestion]: "61705",
  [Icons.Link]: "61706",
  [Icons.Info]: "61707",
  [Icons.InfoOutline]: "61708",
  [Icons.Gift]: "61709",
  [Icons.Filter]: "61710",
  [Icons.FilterOutline]: "61711",
  [Icons.Favorite]: "61712",
  [Icons.FavoriteOutline]: "61713",
  [Icons.Eye]: "61714",
  [Icons.EyeOutline]: "61715",
  [Icons.Edit]: "61716",
  [Icons.EditOutline]: "61717",
  [Icons.Close]: "61718",
  [Icons.Checkmark]: "61719",
  [Icons.Calendar]: "61720",
  [Icons.Browser]: "61721",
  [Icons.Bell]: "61722",
  [Icons.BellOutline]: "61723",
  [Icons.At]: "61724",
  [Icons.ArrowheadUp]: "61725",
  [Icons.ArrowheadRight]: "61726",
  [Icons.ArrowheadLeft]: "61727",
  [Icons.ArrowheadDown]: "61728",
  [Icons.ArrowUpDown]: "61729",
  [Icons.AlertTriangleOutline]: "61730",
  [Icons.Add]: "61731",
  [Icons.AddOutline]: "61732",
};
