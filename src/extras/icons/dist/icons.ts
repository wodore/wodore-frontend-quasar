export type IconsId =
  | "tip"
  | "text-outline"
  | "tent"
  | "sun"
  | "subject"
  | "snow"
  | "ski"
  | "server"
  | "search-outline"
  | "rain"
  | "question-mark"
  | "plus"
  | "no-bed-flat"
  | "mountain"
  | "more-vertical"
  | "minus"
  | "message"
  | "menu"
  | "menu-arrow"
  | "location-share-outline"
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
  | "elevation-outline"
  | "edit"
  | "edit-outline"
  | "copyright"
  | "cloud-offline-outline"
  | "close"
  | "checkmark"
  | "calendar"
  | "browser"
  | "bike"
  | "bell"
  | "bell-outline"
  | "bed-flat"
  | "bed-flat-outline"
  | "at"
  | "arrowhead-up"
  | "arrowhead-right"
  | "arrowhead-left"
  | "arrowhead-down"
  | "arrow-up-down"
  | "api"
  | "alert-triangle-outline"
  | "add"
  | "add-outline";

export type IconsKey =
  | "Tip"
  | "TextOutline"
  | "Tent"
  | "Sun"
  | "Subject"
  | "Snow"
  | "Ski"
  | "Server"
  | "SearchOutline"
  | "Rain"
  | "QuestionMark"
  | "Plus"
  | "NoBedFlat"
  | "Mountain"
  | "MoreVertical"
  | "Minus"
  | "Message"
  | "Menu"
  | "MenuArrow"
  | "LocationShareOutline"
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
  | "ElevationOutline"
  | "Edit"
  | "EditOutline"
  | "Copyright"
  | "CloudOfflineOutline"
  | "Close"
  | "Checkmark"
  | "Calendar"
  | "Browser"
  | "Bike"
  | "Bell"
  | "BellOutline"
  | "BedFlat"
  | "BedFlatOutline"
  | "At"
  | "ArrowheadUp"
  | "ArrowheadRight"
  | "ArrowheadLeft"
  | "ArrowheadDown"
  | "ArrowUpDown"
  | "Api"
  | "AlertTriangleOutline"
  | "Add"
  | "AddOutline";

export enum Icons {
  Tip = "tip",
  TextOutline = "text-outline",
  Tent = "tent",
  Sun = "sun",
  Subject = "subject",
  Snow = "snow",
  Ski = "ski",
  Server = "server",
  SearchOutline = "search-outline",
  Rain = "rain",
  QuestionMark = "question-mark",
  Plus = "plus",
  NoBedFlat = "no-bed-flat",
  Mountain = "mountain",
  MoreVertical = "more-vertical",
  Minus = "minus",
  Message = "message",
  Menu = "menu",
  MenuArrow = "menu-arrow",
  LocationShareOutline = "location-share-outline",
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
  ElevationOutline = "elevation-outline",
  Edit = "edit",
  EditOutline = "edit-outline",
  Copyright = "copyright",
  CloudOfflineOutline = "cloud-offline-outline",
  Close = "close",
  Checkmark = "checkmark",
  Calendar = "calendar",
  Browser = "browser",
  Bike = "bike",
  Bell = "bell",
  BellOutline = "bell-outline",
  BedFlat = "bed-flat",
  BedFlatOutline = "bed-flat-outline",
  At = "at",
  ArrowheadUp = "arrowhead-up",
  ArrowheadRight = "arrowhead-right",
  ArrowheadLeft = "arrowhead-left",
  ArrowheadDown = "arrowhead-down",
  ArrowUpDown = "arrow-up-down",
  Api = "api",
  AlertTriangleOutline = "alert-triangle-outline",
  Add = "add",
  AddOutline = "add-outline",
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.Tip]: "61697",
  [Icons.TextOutline]: "61698",
  [Icons.Tent]: "61699",
  [Icons.Sun]: "61700",
  [Icons.Subject]: "61701",
  [Icons.Snow]: "61702",
  [Icons.Ski]: "61703",
  [Icons.Server]: "61704",
  [Icons.SearchOutline]: "61705",
  [Icons.Rain]: "61706",
  [Icons.QuestionMark]: "61707",
  [Icons.Plus]: "61708",
  [Icons.NoBedFlat]: "61709",
  [Icons.Mountain]: "61710",
  [Icons.MoreVertical]: "61711",
  [Icons.Minus]: "61712",
  [Icons.Message]: "61713",
  [Icons.Menu]: "61714",
  [Icons.MenuArrow]: "61715",
  [Icons.LocationShareOutline]: "61716",
  [Icons.LocationQuestion]: "61717",
  [Icons.Link]: "61718",
  [Icons.Info]: "61719",
  [Icons.InfoOutline]: "61720",
  [Icons.Gift]: "61721",
  [Icons.Filter]: "61722",
  [Icons.FilterOutline]: "61723",
  [Icons.Favorite]: "61724",
  [Icons.FavoriteOutline]: "61725",
  [Icons.Eye]: "61726",
  [Icons.EyeOutline]: "61727",
  [Icons.ElevationOutline]: "61728",
  [Icons.Edit]: "61729",
  [Icons.EditOutline]: "61730",
  [Icons.Copyright]: "61731",
  [Icons.CloudOfflineOutline]: "61732",
  [Icons.Close]: "61733",
  [Icons.Checkmark]: "61734",
  [Icons.Calendar]: "61735",
  [Icons.Browser]: "61736",
  [Icons.Bike]: "61737",
  [Icons.Bell]: "61738",
  [Icons.BellOutline]: "61739",
  [Icons.BedFlat]: "61740",
  [Icons.BedFlatOutline]: "61741",
  [Icons.At]: "61742",
  [Icons.ArrowheadUp]: "61743",
  [Icons.ArrowheadRight]: "61744",
  [Icons.ArrowheadLeft]: "61745",
  [Icons.ArrowheadDown]: "61746",
  [Icons.ArrowUpDown]: "61747",
  [Icons.Api]: "61748",
  [Icons.AlertTriangleOutline]: "61749",
  [Icons.Add]: "61750",
  [Icons.AddOutline]: "61751",
};
