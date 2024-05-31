export type IconsId =
  | 'text-outline'
  | 'subject'
  | 'question-mark'
  | 'more-vertical'
  | 'message'
  | 'menu'
  | 'menu-arrow'
  | 'location-question'
  | 'link'
  | 'info'
  | 'info-outline'
  | 'favorite'
  | 'favorite-outline'
  | 'eye'
  | 'eye-outline'
  | 'edit'
  | 'edit-outline'
  | 'close'
  | 'checkmark'
  | 'calendar'
  | 'at'
  | 'arrowhead-up'
  | 'arrowhead-down'
  | 'arrow-up-down'
  | 'add'
  | 'add-outline';

export type IconsKey =
  | 'TextOutline'
  | 'Subject'
  | 'QuestionMark'
  | 'MoreVertical'
  | 'Message'
  | 'Menu'
  | 'MenuArrow'
  | 'LocationQuestion'
  | 'Link'
  | 'Info'
  | 'InfoOutline'
  | 'Favorite'
  | 'FavoriteOutline'
  | 'Eye'
  | 'EyeOutline'
  | 'Edit'
  | 'EditOutline'
  | 'Close'
  | 'Checkmark'
  | 'Calendar'
  | 'At'
  | 'ArrowheadUp'
  | 'ArrowheadDown'
  | 'ArrowUpDown'
  | 'Add'
  | 'AddOutline';

export enum Icons {
  TextOutline = 'text-outline',
  Subject = 'subject',
  QuestionMark = 'question-mark',
  MoreVertical = 'more-vertical',
  Message = 'message',
  Menu = 'menu',
  MenuArrow = 'menu-arrow',
  LocationQuestion = 'location-question',
  Link = 'link',
  Info = 'info',
  InfoOutline = 'info-outline',
  Favorite = 'favorite',
  FavoriteOutline = 'favorite-outline',
  Eye = 'eye',
  EyeOutline = 'eye-outline',
  Edit = 'edit',
  EditOutline = 'edit-outline',
  Close = 'close',
  Checkmark = 'checkmark',
  Calendar = 'calendar',
  At = 'at',
  ArrowheadUp = 'arrowhead-up',
  ArrowheadDown = 'arrowhead-down',
  ArrowUpDown = 'arrow-up-down',
  Add = 'add',
  AddOutline = 'add-outline',
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.TextOutline]: '61697',
  [Icons.Subject]: '61698',
  [Icons.QuestionMark]: '61699',
  [Icons.MoreVertical]: '61700',
  [Icons.Message]: '61701',
  [Icons.Menu]: '61702',
  [Icons.MenuArrow]: '61703',
  [Icons.LocationQuestion]: '61704',
  [Icons.Link]: '61705',
  [Icons.Info]: '61706',
  [Icons.InfoOutline]: '61707',
  [Icons.Favorite]: '61708',
  [Icons.FavoriteOutline]: '61709',
  [Icons.Eye]: '61710',
  [Icons.EyeOutline]: '61711',
  [Icons.Edit]: '61712',
  [Icons.EditOutline]: '61713',
  [Icons.Close]: '61714',
  [Icons.Checkmark]: '61715',
  [Icons.Calendar]: '61716',
  [Icons.At]: '61717',
  [Icons.ArrowheadUp]: '61718',
  [Icons.ArrowheadDown]: '61719',
  [Icons.ArrowUpDown]: '61720',
  [Icons.Add]: '61721',
  [Icons.AddOutline]: '61722',
};
