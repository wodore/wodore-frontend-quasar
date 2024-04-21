export type IconsId =
  | 'text-outline'
  | 'question-mark'
  | 'more-vertical'
  | 'message'
  | 'menu'
  | 'menu-arrow'
  | 'link'
  | 'favorite'
  | 'favorite-outline'
  | 'eye'
  | 'eye-outline'
  | 'close'
  | 'checkmark'
  | 'at'
  | 'arrowhead-up'
  | 'arrowhead-down'
  | 'arrow-up-down'
  | 'add'
  | 'add-outline';

export type IconsKey =
  | 'TextOutline'
  | 'QuestionMark'
  | 'MoreVertical'
  | 'Message'
  | 'Menu'
  | 'MenuArrow'
  | 'Link'
  | 'Favorite'
  | 'FavoriteOutline'
  | 'Eye'
  | 'EyeOutline'
  | 'Close'
  | 'Checkmark'
  | 'At'
  | 'ArrowheadUp'
  | 'ArrowheadDown'
  | 'ArrowUpDown'
  | 'Add'
  | 'AddOutline';

export enum Icons {
  TextOutline = 'text-outline',
  QuestionMark = 'question-mark',
  MoreVertical = 'more-vertical',
  Message = 'message',
  Menu = 'menu',
  MenuArrow = 'menu-arrow',
  Link = 'link',
  Favorite = 'favorite',
  FavoriteOutline = 'favorite-outline',
  Eye = 'eye',
  EyeOutline = 'eye-outline',
  Close = 'close',
  Checkmark = 'checkmark',
  At = 'at',
  ArrowheadUp = 'arrowhead-up',
  ArrowheadDown = 'arrowhead-down',
  ArrowUpDown = 'arrow-up-down',
  Add = 'add',
  AddOutline = 'add-outline',
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.TextOutline]: '61697',
  [Icons.QuestionMark]: '61698',
  [Icons.MoreVertical]: '61699',
  [Icons.Message]: '61700',
  [Icons.Menu]: '61701',
  [Icons.MenuArrow]: '61702',
  [Icons.Link]: '61703',
  [Icons.Favorite]: '61704',
  [Icons.FavoriteOutline]: '61705',
  [Icons.Eye]: '61706',
  [Icons.EyeOutline]: '61707',
  [Icons.Close]: '61708',
  [Icons.Checkmark]: '61709',
  [Icons.At]: '61710',
  [Icons.ArrowheadUp]: '61711',
  [Icons.ArrowheadDown]: '61712',
  [Icons.ArrowUpDown]: '61713',
  [Icons.Add]: '61714',
  [Icons.AddOutline]: '61715',
};
