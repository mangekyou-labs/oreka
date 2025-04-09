import { createTheme } from '@mui/material/styles';

// Create a theme instance matching the dark blue colors of our app
const muiTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#4A63C8',
            light: '#6A83E8',
            dark: '#3A53B8',
        },
        secondary: {
            main: '#10213A',
            light: '#1D3154',
            dark: '#0A1647',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#0a1647',
            paper: 'rgba(15, 23, 42, 0.9)',
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255,255,255,0.7)',
        },
    },
    typography: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        h4: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 600,
        },
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: '#0F2057',
                    backgroundImage: 'none',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 50,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '1rem',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: 'rgba(255,255,255,0.2)',
                        },
                        '&:hover fieldset': {
                            borderColor: 'white',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: 'white',
                            borderWidth: 1,
                        },
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.2)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white',
                        borderWidth: 1,
                    },
                },
            },
        },
        MuiSlider: {
            styleOverrides: {
                root: {
                    '& .MuiSlider-thumb': {
                        backgroundColor: 'white',
                    },
                    '& .MuiSlider-track': {
                        backgroundColor: '#4A63C8',
                    },
                    '& .MuiSlider-rail': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                    },
                },
            },
        },
    },
});

export default muiTheme; 