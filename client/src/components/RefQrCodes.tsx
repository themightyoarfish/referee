import QRCode from 'react-qr-code';

type JudgeLinks = Partial<Record<RatingKeys, string>>;

const labels: Record<RatingKeys, string> = {
  left: 'Links',
  main: 'Haupt',
  right: 'Rechts',
};

type Props = {
  judgeLinks: JudgeLinks | null;
};

function RefQrCodes({ judgeLinks }: Props) {
  if (!judgeLinks) return null;

  const positions: RatingKeys[] = ['left', 'main', 'right'];

  return (
    <div className='col-span-3 grid grid-cols-3 gap-4 mt-2 mb-4 px-2 z-10'>
      {positions.map((position) => {
        const url = judgeLinks[position];
        if (!url) return null;
        return (
          <div
            key={position}
            className='flex flex-col items-center justify-center bg-white rounded-lg p-2'
          >
            <div className='text-black text-sm font-bold mb-1'>
              {labels[position]}
            </div>
            <QRCode value={url} size={96} level='Q' />
          </div>
        );
      })}
    </div>
  );
}

export default RefQrCodes;
