import showToast from '/js/showToast.js';

window.showToast = showToast;

const saveBtn = document.getElementById('save-btn');

saveBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const resume = document.getElementById('resume').value;
  const location = document.getElementById('skills').value;
  const facebook = document.getElementById('facebook').value;
  const twitter = document.getElementById('twitter').value;
  const linkedin = document.getElementById('linkedin').value;
  const youtube = document.getElementById('youtube').value;
  const github = document.getElementById('github').value;
  const personal = document.getElementById('personal').value;

  const startup = {
    resume,
    location,
    facebook,
    twitter,
    linkedin,
    youtube,
    github,
    personal,
  };

  try {
    const res = await axios({
      method: 'PATCH',
      url: 'http://127.0.0.1:3000/api/v1/users/profile',
      data: startup,
    });
    if (res.data.status === 'success') {
      showToast('Profile Updated', 'bottom', 'right', '#1DA977');
      window.setTimeout(() => window.location.assign('/startups/me'), 1500);
    }
  } catch (err) {
    console.log(err);
    showToast(err.response.data.message, 'bottom', 'right', '#c0392b');
  }
});
