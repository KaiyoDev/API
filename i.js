const axios = require('axios');

const options = {
  method: 'GET',
  url: 'https://ytstream-download-youtube-videos.p.rapidapi.com/dl',
  params: {id: 'UxxajLWwzqY'},
  headers: {
    'x-rapidapi-key': '235b3a5bc2mshef1427d4da7c0fbp118775jsn0aaa0d0a5355',
    'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com'
  }
};

async function fetchData() {
	try {
		const response = await axios.request(options);
		console.log(response.data);
	} catch (error) {
		console.error(error);
	}
}

fetchData();